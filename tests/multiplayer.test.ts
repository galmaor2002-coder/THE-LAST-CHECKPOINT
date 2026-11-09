// Live multiplayer integration test. Runs against a REAL Supabase project.
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... npm run test:multiplayer
// Requires: migrations applied, `game` function deployed, anonymous sign-ins enabled.
// Skipped automatically when the env vars are missing.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, test } from 'vitest';

const URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
const configured = !!(URL && KEY && !URL.includes('YOUR-PROJECT'));

function client(): SupabaseClient {
  return createClient(URL!, KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function signIn(c: SupabaseClient) {
  const { data, error } = await c.auth.signInAnonymously();
  if (error) throw error;
  return data.user!.id;
}

async function game(c: SupabaseClient, body: Record<string, unknown>) {
  const { data, error } = await c.functions.invoke('game', { body });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const j = ctx ? await ctx.json().catch(() => ({})) : {};
    throw new Error(j.error ?? error.message);
  }
  return data;
}

async function viewOf(c: SupabaseClient, matchId: string, uid: string) {
  const { data } = await c.from('player_views').select('view').eq('match_id', matchId).eq('player_id', uid).single();
  return data!.view;
}

describe.skipIf(!configured)('online multiplayer (live Supabase)', () => {
  test('create → join → start → private views → synced actions', async () => {
    const A = client(), B = client(), C = client();
    const [a, b] = await Promise.all([signIn(A), signIn(B), signIn(C)]);

    // Room creation and joining by code
    const { data: room, error: cErr } = await A.rpc('create_room', { p_name: 'Alpha' });
    expect(cErr).toBeNull();
    expect(room.code).toMatch(/^[A-Z2-9]{6}$/);
    const { error: jErr } = await B.rpc('join_room', { p_code: room.code, p_name: 'Bravo' });
    expect(jErr).toBeNull();

    // Third player is rejected; non-members cannot even see the room
    const { error: fullErr } = await C.rpc('join_room', { p_code: room.code, p_name: 'Charlie' });
    expect(fullErr?.message).toMatch(/full/i);
    const { data: peek } = await C.from('rooms').select('*').eq('id', room.id);
    expect(peek).toEqual([]);

    // Only the host can start
    await expect(game(B, { op: 'start', roomId: room.id })).rejects.toThrow(/host/i);
    const started = await game(A, { op: 'start', roomId: room.id });
    const matchId = started.matchId as string;
    expect(matchId).toBeTruthy();

    const { data: match } = await A.from('matches').select('*').eq('id', matchId).single();
    expect(new Set([match.guard_id, match.zombie_id])).toEqual(new Set([a, b]));
    const guard = match.guard_id === a ? A : B, zombie = guard === A ? B : A;
    const guardId = match.guard_id, zombieId = match.zombie_id;

    // Secret state is unreadable by players
    const { data: secrets } = await guard.from('match_secrets').select('*');
    expect(secrets ?? []).toEqual([]);
    // A player cannot read the opponent's view
    const { data: other } = await guard.from('player_views').select('*').eq('player_id', zombieId);
    expect(other).toEqual([]);

    const gv = await viewOf(guard, matchId, guardId);
    const zv = await viewOf(zombie, matchId, zombieId);
    expect(gv.role).toBe('guard');
    expect(zv.role).toBe('zombie');
    const gvText = JSON.stringify(gv);
    for (const k of ['isZombie', 'anomalies', 'herrings', 'covers', 'memory', 'identityOptions', 'options', 'revealAt']) expect(gvText).not.toContain(`"${k}"`);
    expect(gv.visitor.index).toBe(0);

    // Role enforcement on the server
    await expect(game(guard, { op: 'action', roomId: room.id, action: { type: 'queue', on: true } })).rejects.toThrow();
    await expect(game(zombie, { op: 'action', roomId: room.id, action: { type: 'ask', question: 'name' } })).rejects.toThrow();

    // Zombie prepares and steps into line; guard clears visitor #1 and calls the next one
    await game(zombie, { op: 'action', roomId: room.id, action: { type: 'prepare', identity: 'B', covers: ['sunglasses'] } });
    await game(zombie, { op: 'action', roomId: room.id, action: { type: 'queue', on: true } });
    await game(guard, { op: 'action', roomId: room.id, action: { type: 'decide', decision: 'approve' } });
    await game(guard, { op: 'action', roomId: room.id, action: { type: 'next_visitor', actionId: 'n1' } });
    await game(guard, { op: 'action', roomId: room.id, action: { type: 'next_visitor', actionId: 'n1' } }); // duplicate ignored
    const zAt = await viewOf(zombie, matchId, zombieId);
    expect(zAt.atWindow).toBe(true);

    // Realtime: guard asks, zombie answers, guard only sees the answer after the server-side delay
    const gotUpdate = new Promise<void>((resolve) => {
      guard.channel('t').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'player_views', filter: `match_id=eq.${matchId}` }, (p) => {
        const v = (p.new as { view: { visitor: { exchanges: { pending: boolean; answer: string | null }[] } } }).view;
        const last = v.visitor?.exchanges.at(-1);
        if (last && !last.pending && last.answer) resolve();
      }).subscribe();
    });
    await new Promise((r) => setTimeout(r, 1500));
    await game(guard, { op: 'action', roomId: room.id, action: { type: 'ask', question: 'origin' } });
    const zq = await viewOf(zombie, matchId, zombieId);
    expect(zq.prompt.options.length).toBeGreaterThanOrEqual(2);
    await game(zombie, { op: 'action', roomId: room.id, action: { type: 'respond', exchangeId: zq.prompt.exchangeId, option: 0 } });
    const gPending = await viewOf(guard, matchId, guardId);
    expect(gPending.visitor.exchanges.at(-1).answer).toBeNull(); // nothing leaked before the reveal time
    for (let i = 0; i < 6; i++) { await new Promise((r) => setTimeout(r, 1000)); await game(guard, { op: 'action', roomId: room.id, action: { type: 'tick' } }); }
    await Promise.race([gotUpdate, new Promise((_, rej) => setTimeout(() => rej(new Error('no realtime update within 10s')), 10_000))]);

    // Forfeit ends the match for both
    await game(zombie, { op: 'forfeit', roomId: room.id });
    const final = await viewOf(guard, matchId, guardId);
    expect(final.phase).toBe('finished');
    expect(final.result.winner).toBe('guard');

    await Promise.all([A, B, C].map((c) => c.removeAllChannels()));
  });
});
