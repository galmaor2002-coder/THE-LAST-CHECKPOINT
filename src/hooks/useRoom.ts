import { useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { heartbeat, type MatchRow, type RoomRow } from '../lib/api';
import { sb } from '../lib/supabase';

export interface RoomState {
  room: RoomRow | null;
  match: MatchRow | null;
  online: Record<string, boolean>; // user id -> present in realtime presence
  connected: boolean; // our own realtime connection
}

/** Live room row + current match row + presence (who has the page open right now). */
export function useRoom(initial: RoomRow, uid: string): RoomState {
  const [room, setRoom] = useState<RoomRow | null>(initial);
  const [match, setMatch] = useState<MatchRow | null>(null);
  const [online, setOnline] = useState<Record<string, boolean>>({});
  const [connected, setConnected] = useState(false);
  const roomId = initial.id;
  const matchIdRef = useRef<string | null>(null);

  const refetch = async () => {
    const { data } = await sb().from('rooms').select('*').eq('id', roomId).maybeSingle();
    if (data) setRoom(data as RoomRow);
  };

  // current match row
  useEffect(() => {
    const mid = room?.current_match_id ?? null;
    matchIdRef.current = mid;
    if (!mid) { setMatch(null); return; }
    let alive = true;
    sb().from('matches').select('*').eq('id', mid).maybeSingle().then(({ data }) => {
      if (alive && data && matchIdRef.current === mid) setMatch(data as MatchRow);
    });
    return () => { alive = false; };
  }, [room?.current_match_id, room?.status]);

  useEffect(() => {
    const client = sb();
    const ch: RealtimeChannel = client.channel(`room:${roomId}`, { config: { presence: { key: uid } } });
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, (p) => {
      if (p.new && 'id' in p.new) setRoom(p.new as RoomRow);
    });
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `room_id=eq.${roomId}` }, (p) => {
      const m = p.new as MatchRow;
      if (m?.id && m.id === matchIdRef.current) setMatch(m);
    });
    ch.on('presence', { event: 'sync' }, () => {
      const st = ch.presenceState();
      const o: Record<string, boolean> = {};
      for (const k of Object.keys(st)) o[k] = true;
      setOnline(o);
    });
    ch.subscribe(async (status) => {
      setConnected(status === 'SUBSCRIBED');
      if (status === 'SUBSCRIBED') {
        await ch.track({ uid, at: Date.now() });
        void refetch(); // catch anything missed while (re)connecting
      }
    });

    const hb = setInterval(() => { void heartbeat(roomId); }, 15_000);
    void heartbeat(roomId);
    const poll = setInterval(() => { void refetch(); }, 12_000); // safety net if realtime drops
    const onVis = () => { if (document.visibilityState === 'visible') { void refetch(); void heartbeat(roomId); } };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(hb); clearInterval(poll);
      document.removeEventListener('visibilitychange', onVis);
      void client.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, uid]);

  return { room, match, online, connected };
}
