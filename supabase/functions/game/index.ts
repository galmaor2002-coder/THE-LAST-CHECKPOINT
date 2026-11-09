// Supabase Edge Function: `game`
// The single authoritative entry point for match lifecycle and game actions.
//
// POST { op: 'start' | 'action' | 'forfeit' | 'claim_forfeit', roomId: string, action?: AnyAction }
// Authorization: Bearer <user access token>   (anonymous guest sessions are fine)
//
// The full MatchState lives in `match_secrets` (service-role only). After each
// action we write role-filtered views to `player_views`, which each client
// reads/subscribes to under RLS (player_id = auth.uid()).

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { ActionError, applyAction, buildView, createMatch, forfeit } from '../_shared/engine/engine.ts';
import type { AnyAction, MatchState, Role } from '../_shared/engine/types.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const DISCONNECT_GRACE_MS = 90_000;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

interface Room {
  id: string;
  code: string;
  host_id: string;
  guest_id: string | null;
  status: string;
  current_match_id: string | null;
  match_count: number;
  host_seen_at: string;
  guest_seen_at: string | null;
}

interface Match {
  id: string;
  room_id: string;
  guard_id: string;
  zombie_id: string;
  status: string;
}

function randomSeed(): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] | 0;
}

async function writeViews(
  admin: SupabaseClient,
  match: Match,
  prev: MatchState | null,
  next: MatchState,
  now: number,
) {
  const rows = [];
  for (const [role, pid] of [['guard', match.guard_id], ['zombie', match.zombie_id]] as [Role, string][]) {
    const nv = buildView(next, role, now);
    if (prev) {
      // Only write a player's row if THEIR view actually changed, so an opponent's
      // private action never produces an observable realtime event on the other side.
      const pv = buildView(prev, role, now);
      const strip = (v: unknown) => JSON.stringify({ ...(v as object), serverNow: 0 });
      if (strip(pv) === strip(nv)) continue;
    }
    rows.push({ match_id: match.id, player_id: pid, role, view: nv, updated_at: new Date(now).toISOString() });
  }
  if (rows.length) {
    const { error } = await admin.from('player_views').upsert(rows, { onConflict: 'match_id,player_id' });
    if (error) throw new Error(error.message);
  }
}

async function finalizeIfFinished(admin: SupabaseClient, room: Room, match: Match, s: MatchState) {
  if (s.phase !== 'finished') return;
  await admin.from('matches').update({
    status: 'finished',
    winner: s.winner,
    win_reason: s.winReason,
    ended_at: new Date().toISOString(),
  }).eq('id', match.id);
  await admin.from('rooms').update({ status: 'finished', updated_at: new Date().toISOString() }).eq('id', room.id);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const auth = req.headers.get('Authorization') ?? '';
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data: userData, error: userErr } = await userClient.auth.getUser(auth.replace(/^Bearer\s+/i, ''));
  if (userErr || !userData.user) return json({ error: 'Not signed in' }, 401);
  const uid = userData.user.id;

  let body: { op?: string; roomId?: string; action?: AnyAction };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  const { op, roomId } = body;
  if (!op || !roomId || typeof roomId !== 'string') return json({ error: 'Missing op or roomId' }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: room, error: roomErr } = await admin.from('rooms').select('*').eq('id', roomId).maybeSingle<Room>();
  if (roomErr) return json({ error: roomErr.message }, 500);
  if (!room) return json({ error: 'Room not found' }, 404);
  if (room.host_id !== uid && room.guest_id !== uid) return json({ error: 'You are not in this room' }, 403);

  try {
    // ------------------------------------------------------------ start / rematch
    if (op === 'start') {
      if (room.host_id !== uid) return json({ error: 'Only the host can start the match' }, 403);
      if (!room.guest_id) return json({ error: 'Waiting for the second player' }, 409);
      if (room.status === 'playing') return json({ error: 'A match is already running' }, 409);
      if (room.status === 'closed') return json({ error: 'Room closed' }, 409);

      const now = Date.now();
      const hostIsGuard = (randomSeed() & 1) === 0; // roles: always random
      const guard_id = hostIsGuard ? room.host_id : room.guest_id;
      const zombie_id = hostIsGuard ? room.guest_id : room.host_id;
      const state = createMatch(randomSeed(), now);

      // Claim the room atomically so a double-click cannot start two matches.
      const { data: claimed } = await admin.from('rooms')
        .update({ status: 'playing', current_match_id: null, updated_at: new Date(now).toISOString() })
        .eq('id', room.id).neq('status', 'playing').select('id');
      if (!claimed?.length) return json({ error: 'A match is already running' }, 409);

      const { data: match, error: mErr } = await admin.from('matches')
        .insert({ room_id: room.id, number: room.match_count + 1, guard_id, zombie_id })
        .select('*').single<Match>();
      if (mErr || !match) {
        await admin.from('rooms').update({ status: room.status, current_match_id: room.current_match_id }).eq('id', room.id);
        throw new Error(mErr?.message ?? 'Could not create match');
      }
      const { error: sErr } = await admin.from('match_secrets').insert({ match_id: match.id, state, version: 1 });
      if (sErr) throw new Error(sErr.message);
      await writeViews(admin, match, null, state, now);
      await admin.from('rooms').update({
        current_match_id: match.id,
        match_count: room.match_count + 1,
        updated_at: new Date(now).toISOString(),
      }).eq('id', room.id);
      return json({ ok: true, matchId: match.id });
    }

    // ------------------------------------------------------------ in-match ops
    if (!room.current_match_id) return json({ error: 'No match in this room yet' }, 409);
    const { data: match } = await admin.from('matches').select('*').eq('id', room.current_match_id).single<Match>();
    if (!match) return json({ error: 'Match not found' }, 404);
    const role: Role = match.guard_id === uid ? 'guard' : 'zombie';

    for (let attempt = 0; attempt < 5; attempt++) {
      const { data: secret } = await admin.from('match_secrets').select('state, version').eq('match_id', match.id)
        .single<{ state: MatchState; version: number }>();
      if (!secret) return json({ error: 'Match state missing' }, 500);
      const prev = secret.state;
      const now = Date.now();
      let next: MatchState;

      if (op === 'action') {
        if (!body.action || typeof body.action !== 'object') return json({ error: 'Missing action' }, 400);
        const r = applyAction(prev, role, body.action, now);
        if (r.duplicate) return json({ ok: true, duplicate: true });
        next = r.state;
      } else if (op === 'forfeit') {
        if (prev.phase === 'finished') return json({ ok: true });
        next = forfeit(prev, role, now);
      } else if (op === 'claim_forfeit') {
        if (prev.phase === 'finished') return json({ ok: true });
        const oppSeen = uid === room.host_id ? room.guest_seen_at : room.host_seen_at;
        const lastSeen = oppSeen ? Date.parse(oppSeen) : 0;
        if (now - lastSeen < DISCONNECT_GRACE_MS) {
          return json({ error: 'Opponent is still within the reconnection window' }, 409);
        }
        next = forfeit(prev, role === 'guard' ? 'zombie' : 'guard', now);
      } else {
        return json({ error: 'Unknown op' }, 400);
      }

      if (JSON.stringify(next) === JSON.stringify(prev)) return json({ ok: true, unchanged: true });

      // Optimistic concurrency: only write if nobody else wrote since we read.
      const { data: written, error: wErr } = await admin.from('match_secrets')
        .update({ state: next, version: secret.version + 1, updated_at: new Date(now).toISOString() })
        .eq('match_id', match.id).eq('version', secret.version).select('version');
      if (wErr) throw new Error(wErr.message);
      if (!written?.length) continue; // lost the race -> re-read and re-apply

      await writeViews(admin, match, prev, next, now);
      await finalizeIfFinished(admin, room, match, next);
      return json({ ok: true });
    }
    return json({ error: 'Server busy, try again' }, 503);
  } catch (e) {
    if (e instanceof ActionError) return json({ error: e.message }, 422);
    console.error(e);
    return json({ error: (e as Error).message ?? 'Server error' }, 500);
  }
});
