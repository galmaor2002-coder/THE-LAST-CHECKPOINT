import type { AnyAction } from '@engine/types.ts';
import { ensureSession, sb } from './supabase';

export interface RoomRow {
  id: string;
  code: string;
  host_id: string;
  guest_id: string | null;
  host_name: string;
  guest_name: string | null;
  status: 'lobby' | 'playing' | 'finished' | 'closed';
  current_match_id: string | null;
  match_count: number;
  expires_at: string;
}

export interface MatchRow {
  id: string;
  room_id: string;
  number: number;
  guard_id: string;
  zombie_id: string;
  status: 'active' | 'finished';
  winner: 'guard' | 'zombie' | null;
}

function rpcError(e: { message?: string } | null): never {
  throw new Error(e?.message ?? 'Request failed');
}

export async function createRoom(name: string): Promise<RoomRow> {
  await ensureSession();
  const { data, error } = await sb().rpc('create_room', { p_name: name });
  if (error) rpcError(error);
  return data as RoomRow;
}

export async function joinRoom(code: string, name: string): Promise<RoomRow> {
  await ensureSession();
  const { data, error } = await sb().rpc('join_room', { p_code: code.trim().toUpperCase(), p_name: name });
  if (error) rpcError(error);
  return data as RoomRow;
}

export async function leaveRoom(roomId: string) {
  await sb().rpc('leave_room', { p_room: roomId });
}

export async function heartbeat(roomId: string) {
  await sb().rpc('heartbeat', { p_room: roomId });
}

async function callGame(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  await ensureSession();
  const { data, error } = await sb().functions.invoke('game', { body });
  if (error) {
    let msg = error.message;
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      try {
        const j = await ctx.json();
        if (j?.error) msg = j.error;
      } catch { /* ignore */ }
    }
    throw new Error(msg);
  }
  return data as Record<string, unknown>;
}

export const startMatch = (roomId: string) => callGame({ op: 'start', roomId });
export const forfeitMatch = (roomId: string) => callGame({ op: 'forfeit', roomId });
export const claimForfeit = (roomId: string) => callGame({ op: 'claim_forfeit', roomId });

export function sendAction(roomId: string, action: AnyAction) {
  const actionId = action.actionId ?? (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);
  return callGame({ op: 'action', roomId, action: { ...action, actionId } });
}
