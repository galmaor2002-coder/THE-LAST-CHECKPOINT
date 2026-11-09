import { useEffect, useState } from 'react';
import type { PlayerView } from '@engine/types.ts';
import { sb } from '../lib/supabase';

/**
 * Subscribes to THIS player's filtered view of the match.
 * RLS guarantees the row returned/streamed is only ever player_id = auth.uid().
 */
export function useMatchView(matchId: string | null, uid: string) {
  const [view, setView] = useState<PlayerView | null>(null);
  const [stamp, setStamp] = useState(0);

  useEffect(() => {
    setView(null);
    if (!matchId) return;
    const client = sb();
    let alive = true;
    const fetchView = async () => {
      const { data } = await client.from('player_views').select('view, updated_at')
        .eq('match_id', matchId).eq('player_id', uid).maybeSingle();
      if (alive && data) { setView(data.view as PlayerView); setStamp(Date.now()); }
    };
    void fetchView();
    const ch = client.channel(`view:${matchId}:${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player_views', filter: `match_id=eq.${matchId}` }, (p) => {
        const row = p.new as { player_id?: string; view?: PlayerView };
        if (row?.player_id === uid && row.view) { setView(row.view); setStamp(Date.now()); }
      })
      .subscribe((status) => { if (status === 'SUBSCRIBED') void fetchView(); });
    const poll = setInterval(fetchView, 8_000);
    const onVis = () => { if (document.visibilityState === 'visible') void fetchView(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      alive = false;
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVis);
      void client.removeChannel(ch);
    };
  }, [matchId, uid]);

  return { view, stamp };
}

/** Ticking clock for countdowns. */
export function useNow(intervalMs = 250) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
