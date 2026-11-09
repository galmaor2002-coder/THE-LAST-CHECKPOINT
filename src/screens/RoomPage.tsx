import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { AnyAction } from '@engine/types.ts';
import { claimForfeit, forfeitMatch, joinRoom, leaveRoom, sendAction, startMatch, type RoomRow } from '../lib/api';
import { ensureSession, isConfigured } from '../lib/supabase';
import { getName, navigate, setName } from '../lib/util';
import { sfx, unlockAudio } from '../lib/sound';
import { useRoom } from '../hooks/useRoom';
import { useMatchView, useNow } from '../hooks/useMatchView';
import { Atmosphere } from '../components/Atmosphere';
import { Banner, Toast } from '../components/ui';
import { Lobby } from './Lobby';
import { RoleReveal } from './RoleReveal';
import { GuardBooth } from './GuardBooth';
import { ZombieScreen } from './ZombieScreen';
import { ResultScreen } from './ResultScreen';

const RECONNECT_WINDOW_S = 90;

function Centered({ children }: { children: ReactNode }) {
  return (
    <>
      <Atmosphere />
      <main className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-4 px-5 py-10">{children}</main>
    </>
  );
}

export function RoomPage({ code }: { code: string }) {
  const [phase, setPhase] = useState<'name' | 'connecting' | 'ready' | 'error'>(getName() ? 'connecting' : 'name');
  const [room, setRoom] = useState<RoomRow | null>(null);
  const [uid, setUid] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [name, setN] = useState('');

  useEffect(() => {
    if (phase !== 'connecting') return;
    if (!isConfigured) { setErr('Online play is not configured on this deployment (missing Supabase environment variables).'); setPhase('error'); return; }
    let alive = true;
    (async () => {
      try {
        const id = await ensureSession();
        const r = await joinRoom(code, getName() || 'Player 2');
        if (!alive) return;
        setUid(id); setRoom(r); setPhase('ready');
      } catch (e) {
        if (!alive) return;
        setErr((e as Error).message); setPhase('error');
      }
    })();
    return () => { alive = false; };
  }, [phase, code]);

  if (phase === 'name') {
    return (
      <Centered>
        <p className="label text-blood-400">Invitation received · room {code}</p>
        <h2 className="title text-4xl">Who's at the radio?</h2>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); unlockAudio(); sfx.click(); setName(name || 'Player 2'); setPhase('connecting'); }}>
          <input className="input" autoFocus maxLength={20} placeholder="Your callsign" value={name} onChange={(e) => setN(e.target.value)} />
          <button className="btn-red w-full !py-4 !text-lg">Join the game</button>
        </form>
      </Centered>
    );
  }
  if (phase === 'connecting') {
    return <Centered><p className="title animate-pulse text-center text-2xl">Establishing secure channel…</p><p className="text-center font-mono text-sm text-ash-400">Room {code}</p></Centered>;
  }
  if (phase === 'error' || !room) {
    return (
      <Centered>
        <h2 className="title text-3xl">Channel unavailable</h2>
        <Banner tone="danger">{err ?? 'Unknown error'}</Banner>
        <button className="btn-ghost" onClick={() => navigate('/')}>Main menu</button>
      </Centered>
    );
  }
  return <RoomInner initial={room} uid={uid} />;
}

function RoomInner({ initial, uid }: { initial: RoomRow; uid: string }) {
  const { room, match, online, connected } = useRoom(initial, uid);
  const r = room ?? initial;
  const matchId = r.current_match_id && r.status !== 'lobby' ? r.current_match_id : null;
  const { view } = useMatchView(matchId, uid);
  const now = useNow(250);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<string | null>(() => sessionStorage.getItem('tlc-revealed'));
  const [offlineSince, setOfflineSince] = useState<number | null>(null);

  const isHost = r.host_id === uid;
  const opponentId = isHost ? r.guest_id : r.host_id;
  const opponentOnline = !!opponentId && !!online[opponentId];

  // Track how long the opponent has been gone (presence-based).
  useEffect(() => {
    if (!opponentId || opponentOnline) { setOfflineSince(null); return; }
    // presence takes a moment after load; only start counting once we're subscribed ourselves
    if (connected) setOfflineSince((s) => s ?? Date.now());
  }, [opponentId, opponentOnline, connected]);

  const act = useCallback(async (a: AnyAction) => {
    try {
      await sendAction(r.id, a);
      return true;
    } catch (e) {
      sfx.deny();
      setToast((e as Error).message);
      return false;
    }
  }, [r.id]);

  // Timed reveals: answers are released by the server only once their (randomised) delay has passed.
  // The guard nudges the server while an answer is pending; the zombie nudges once if its own timer runs out.
  const tickRef = useRef(false);
  useEffect(() => {
    if (!view || view.phase !== 'visit') return;
    const send = () => {
      if (tickRef.current) return;
      tickRef.current = true;
      sendAction(r.id, { type: 'tick' }).catch(() => {}).finally(() => { tickRef.current = false; });
    };
    if (view.role === 'guard' && view.pending) {
      const t = setInterval(send, 1500);
      return () => clearInterval(t);
    }
    if (view.role === 'zombie' && view.prompt) {
      const t = setTimeout(send, Math.max(0, view.prompt.deadline - Date.now()) + 800);
      return () => clearTimeout(t);
    }
  }, [view, r.id]);

  const start = async () => {
    sfx.click(); setBusy(true); setError(null);
    try { await startMatch(r.id); } catch (e) { setError((e as Error).message); }
    setBusy(false);
  };
  const toMenu = async () => {
    sfx.click();
    if (r.status === 'lobby' || r.status === 'finished') await leaveRoom(r.id).catch(() => {});
    navigate('/');
  };
  const quit = async () => {
    if (!window.confirm('Forfeit this match? Your opponent wins.')) return;
    await forfeitMatch(r.id).catch(() => {});
  };

  const alarm = view?.role === 'zombie' && view.atWindow ? 1 : 0;
  const boothMode = !!view && view.role === 'guard' && view.phase !== 'finished' && revealed === matchId;

  if (r.status === 'closed') {
    return (
      <Centered>
        <h2 className="title text-3xl">Room closed</h2>
        <p className="text-ash-400">The host closed this room.</p>
        <button className="btn-ghost" onClick={() => navigate('/')}>Main menu</button>
      </Centered>
    );
  }

  let body: ReactNode;
  if (!matchId && r.status === 'playing') {
    body = <main className="flex min-h-full items-center justify-center"><p className="title animate-pulse text-2xl">Assigning roles…</p></main>;
  } else if (!matchId) {
    body = <Lobby room={r} uid={uid} online={online} onStart={start} onLeave={toMenu} starting={busy} error={error} />;
  } else if (!view) {
    body = <main className="flex min-h-full items-center justify-center"><p className="title animate-pulse text-2xl">Assigning roles…</p></main>;
  } else if (view.phase === 'finished') {
    body = <ResultScreen view={view} isHost={isHost} onRematch={start} onMenu={toMenu} rematchBusy={busy} error={error} />;
  } else if (revealed !== matchId) {
    body = <RoleReveal role={view.role} matchNumber={match?.number ?? r.match_count} onContinue={() => { sessionStorage.setItem('tlc-revealed', matchId); setRevealed(matchId); }} />;
  } else if (view.role === 'guard') {
    body = <GuardBooth view={view} act={act} now={now} />;
  } else {
    body = <ZombieScreen view={view} act={act} now={now} />;
  }

  const offlineFor = offlineSince ? Math.floor((now - offlineSince) / 1000) : 0;
  const inMatch = !!matchId && view && view.phase !== 'finished';

  return (
    <>
      {!boothMode && <Atmosphere alarm={alarm} intensity={alarm ? 1.4 : 1} />}
      {!connected && <div className="fixed inset-x-0 top-0 z-50 bg-warn-600 px-3 py-1 text-center font-mono text-xs text-coal-950">Connection lost — reconnecting…</div>}
      {inMatch && offlineSince && offlineFor > 3 && (
        <div className="fixed inset-x-3 top-3 z-50 mx-auto max-w-lg">
          <Banner tone="danger">
            {offlineFor < RECONNECT_WINDOW_S ? (
              <>Opponent disconnected. Waiting for them to reconnect… {RECONNECT_WINDOW_S - offlineFor}s</>
            ) : (
              <span className="flex flex-wrap items-center gap-2">
                Opponent has left the match.
                <button className="btn-red !px-2 !py-1 !text-[11px]" onClick={() => claimForfeit(r.id).catch((e) => setToast((e as Error).message))}>Claim victory</button>
                <button className="btn-ghost !px-2 !py-1 !text-[11px]" onClick={toMenu}>Main menu</button>
              </span>
            )}
          </Banner>
        </div>
      )}
      {!inMatch && matchId === null && r.guest_id && !opponentOnline && offlineSince && offlineFor > 10 && (
        <div className="fixed inset-x-3 top-3 z-50 mx-auto max-w-lg"><Banner tone="warn">The other player is not connected right now.</Banner></div>
      )}
      {body}
      {inMatch && revealed === matchId && (
        <button onClick={quit} className="label fixed right-3 top-12 z-20 opacity-40 hover:opacity-100">Forfeit</button>
      )}
      <Toast msg={toast} onDone={() => setToast(null)} />
    </>
  );
}
