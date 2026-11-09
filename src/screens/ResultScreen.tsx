import { motion } from 'framer-motion';
import { useEffect } from 'react';
import type { PlayerView } from '@engine/types.ts';
import { ANOMALY_TEXT, COVERS, HERRING_TEXT } from '@engine/data.ts';
import { cx, fmtDuration } from '../lib/util';
import { sfx } from '../lib/sound';
import { Portrait } from '../components/Portrait';
import { Banner, Panel } from '../components/ui';

export function ResultScreen({
  view, isHost, onRematch, onMenu, rematchBusy, error,
}: {
  view: PlayerView; isHost: boolean; onRematch: () => void; onMenu: () => void; rematchBusy: boolean; error: string | null;
}) {
  const r = view.result!;
  const won = r.winner === view.role;
  useEffect(() => { won ? sfx.win() : sfx.lose(); }, [won]);
  const c = r.counters;
  const stats: [string, string | number][] = [
    ['Shift length', fmtDuration(r.durationSec)],
    ['Visitors seen', r.visitors.length],
    ['Questions (preset / typed)', `${c.questions} / ${c.freeQuestions}`],
    ['Orders given', c.requests],
    ['Tools used', c.tools],
    ['Innocents approved', c.innocentsApproved],
    ['Innocents denied', c.innocentsDenied],
    ['Sabotage used', c.sabotageUsed],
    ['Final trust', r.trust],
  ];

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <motion.div initial={{ opacity: 0, scale: 1.08 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.9 }} className="text-center">
        <p className="label">{r.winner === 'guard' ? 'The checkpoint holds' : 'The checkpoint has fallen'}</p>
        <h1 className={cx('mt-2 font-display text-6xl font-bold uppercase tracking-wider sm:text-8xl', won ? 'text-safe-400' : 'text-blood-500')}>{won ? 'Victory' : 'Defeat'}</h1>
        <p className="mx-auto mt-3 max-w-lg text-ash-300">{r.headline}</p>
        <p className="label mt-2">You played the {view.role === 'guard' ? 'Guard' : 'Infiltrator'}</p>
      </motion.div>

      <h2 className="label mb-2 mt-8">The truth about tonight's visitors</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {r.visitors.map((v, i) => (
          <motion.div key={v.index} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i * 0.15 }}
            className={cx('panel p-2', v.isZombie && '!border-blood-500 shadow-[0_0_30px_-6px_rgba(201,35,42,0.8)]')}>
            <div className="aspect-square overflow-hidden bg-[#2c2a38]"><Portrait ap={v.appearance} className="h-full w-full" showHands={false} /></div>
            <p className="title mt-1 truncate text-sm">#{v.index + 1} {v.name}</p>
            <p className={cx('font-mono text-[10px] uppercase', v.isZombie ? 'text-blood-400' : 'text-ash-400')}>{v.isZombie ? 'INFECTED' : 'Human'}</p>
            <p className={cx('font-mono text-[11px] uppercase', v.decision === 'approve' ? 'text-safe-400' : v.decision === 'deny' ? 'text-warn-400' : 'text-ash-500')}>{v.decision ?? '—'}</p>
            <ul className="mt-1 space-y-0.5 text-[10px] leading-tight text-ash-400">
              {v.anomalies.map((a) => <li key={a} className="text-blood-400">• {ANOMALY_TEXT[a].split(' — ')[0]}</li>)}
              {v.covers.filter(() => v.isZombie).map((c) => <li key={c}>◦ wore {COVERS[c].name.toLowerCase()}</li>)}
              {v.herrings.map((h) => <li key={h}>• {HERRING_TEXT[h]}</li>)}
            </ul>
          </motion.div>
        ))}
      </div>

      <Panel className="mt-4" title="Shift statistics">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-3">
          {stats.map(([k, val]) => (
            <div key={k} className="flex justify-between border-b border-coal-700 pb-1 text-sm"><dt className="text-ash-400">{k}</dt><dd className="font-mono text-ash-100">{val}</dd></div>
          ))}
        </dl>
      </Panel>

      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        {isHost ? (
          <button className="btn-red !py-4" disabled={rematchBusy} onClick={onRematch}>{rematchBusy ? 'Reassigning roles…' : 'Rematch (new random roles)'}</button>
        ) : (
          <Banner tone="info">Waiting for the host to start a rematch…</Banner>
        )}
        <button className="btn-ghost !py-4" onClick={onMenu}>Main menu</button>
      </div>
      {error && <div className="mt-3"><Banner tone="danger">{error}</Banner></div>}
    </main>
  );
}
