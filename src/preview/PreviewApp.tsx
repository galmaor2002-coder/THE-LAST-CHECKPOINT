// OFFLINE PREVIEW ONLY: both roles on one device, engine running in the browser.
// Real matches run the engine on the server, and each player sees only their own view on their own device.
import { useEffect, useState } from 'react';
import type { AnyAction, MatchState, Role, ZombieView } from '@engine/types.ts';
import { applyAction, buildView, createMatch } from '@engine/engine.ts';
import { Atmosphere } from '../components/Atmosphere';
import { Toast } from '../components/ui';
import { GuardBooth } from '../screens/GuardBooth';
import { ZombieScreen } from '../screens/ZombieScreen';
import { ResultScreen } from '../screens/ResultScreen';
import { cx } from '../lib/util';
import { unlockAudio } from '../lib/sound';

const seed = () => (Math.random() * 2 ** 31) | 0;

export function PreviewApp() {
  const [state, setState] = useState<MatchState | null>(null);
  const [as, setAs] = useState<Role>('guard');
  const [now, setNow] = useState(Date.now());
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      setState((s) => {
        if (!s) return s;
        try { return applyAction(s, 'guard', { type: 'tick' }, n).state; } catch { return s; }
      });
    }, 400);
    return () => clearInterval(t);
  }, []);

  const actFor = (role: Role) => async (a: AnyAction) => {
    if (!state) return false;
    try {
      setState(applyAction(state, role, a, Date.now()).state);
      return true;
    } catch (e) {
      setToast((e as Error).message);
      return false;
    }
  };

  if (!state) {
    return (
      <>
        <Atmosphere />
        <main className="mx-auto flex min-h-full max-w-xl flex-col justify-center px-5 py-10">
          <p className="label mb-3 text-blood-400">Offline preview · Checkpoint 7</p>
          <h1 className="font-display text-5xl font-bold uppercase leading-[0.9] tracking-[0.04em] text-ash-100 sm:text-7xl">
            The Last<br /><span className="animate-flicker text-blood-500 [text-shadow:0_0_30px_rgba(201,35,42,0.6)]">Checkpoint</span>
          </h1>
          <p className="mt-4 text-ash-300">Six visitors. One window. One of them is not human.</p>
          <div className="panel mt-6 p-4 text-sm text-ash-300">
            <b className="text-warn-400">Preview mode.</b> Both roles run in this page. Use the switch in the top-right corner to flip between the Guard's booth and the Infiltrator's screen.
            In the real game each player is on their own device and never sees the other side.
          </div>
          <button className="btn-red mt-6 w-full !py-4 !text-lg" onClick={() => { unlockAudio(); setState(createMatch(seed(), Date.now())); }}>Start a preview shift</button>
        </main>
      </>
    );
  }

  const view = buildView(state, as, now);
  const zv = buildView(state, 'zombie', now) as ZombieView;
  const zombieTurn = !!zv.prompt;

  let body;
  if (view.phase === 'finished') {
    body = <><Atmosphere /><ResultScreen view={view} isHost onRematch={() => setState(createMatch(seed(), Date.now()))} onMenu={() => setState(null)} rematchBusy={false} error={null} /></>;
  } else if (view.role === 'guard') {
    body = <GuardBooth view={view} act={actFor('guard')} now={now} />;
  } else {
    body = <><Atmosphere alarm={view.atWindow ? 1 : 0} /><ZombieScreen view={view} act={actFor('zombie')} now={now} /></>;
  }

  return (
    <>
      {body}
      <div className="fixed left-1/2 top-1 z-[60] flex -translate-x-1/2 flex-col items-center gap-1">
        <div className="flex border-2 border-black bg-coal-950/90 p-0.5 shadow-lg">
          {(['guard', 'zombie'] as Role[]).map((r) => (
            <button key={r} onClick={() => setAs(r)} className={cx('px-2 py-1 font-display text-[11px] uppercase tracking-wider', as === r ? (r === 'guard' ? 'bg-ash-200 text-coal-950' : 'bg-blood-600 text-white') : 'text-ash-400')}>
              {r === 'guard' ? 'Guard' : 'Infiltrator'}
            </button>
          ))}
        </div>
        {as === 'guard' && zombieTurn && <span className="animate-pulse bg-blood-700 px-2 py-0.5 font-mono text-[10px] text-white">Infiltrator must answer →</span>}
        {as === 'guard' && !zv.arrived && !zombieTurn && state.current === 0 && <span className="bg-coal-900/90 px-2 py-0.5 font-mono text-[10px] text-warn-400">Tip: switch to Infiltrator to build the disguise</span>}
      </div>
      <Toast msg={toast} onDone={() => setToast(null)} />
    </>
  );
}
