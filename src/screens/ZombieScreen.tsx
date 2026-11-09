// The infiltrator's private interface: build a disguise, pick the moment to step into line,
// sabotage the guard's tools, and talk your way through the window.
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import type { Anomaly, AnyAction, Cover, FactKey, Sabotage, ZombieView } from '@engine/types.ts';
import { ANOMALY_TEXT, CONFIG, COVERS, SABOTAGE } from '@engine/data.ts';
import { cx } from '../lib/util';
import { sfx } from '../lib/sound';
import { Portrait, faceOnly } from '../components/Portrait';
import { Countdown, LogFeed, MuteButton, Panel } from '../components/ui';

const FACT_LABEL: Record<FactKey, string> = { origin: 'Came from', dob: 'Born', job: 'Worked as', contact: 'Emergency contact' };

export function ZombieScreen({ view, act, now }: { view: ZombieView; act: (a: AnyAction) => Promise<boolean>; now: number }) {
  const [busy, setBusy] = useState(false);
  const [identity, setIdentity] = useState<'A' | 'B' | 'C'>(view.chosen ?? 'A');
  const [covers, setCovers] = useState<Cover[]>(view.covers);
  const v = view.visitor;
  const p = view.prompt;

  useEffect(() => { if (p) sfx.alert(); }, [p?.exchangeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (a: AnyAction, sound?: () => void) => {
    if (busy) return false;
    setBusy(true); sound?.();
    const ok = await act(a);
    setBusy(false);
    return ok;
  };

  const toggleCover = (c: Cover) => {
    sfx.click();
    setCovers((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : cs.length >= CONFIG.zombieCovers ? cs : [...cs, c]));
  };
  const dirty = !view.prepared || identity !== view.chosen || covers.slice().sort().join() !== view.covers.slice().sort().join();
  const covered = (a: Anomaly) => (view.prepared ? view.covers : covers).some((c) => COVERS[c].hides === a);
  const nextSlot = view.phase === 'between' ? view.current + 2 : view.current + 2;

  return (
    <div className="mx-auto max-w-6xl px-3 pb-10 pt-3 sm:px-5">
      <header className="panel mb-3 !border-blood-700 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-baseline gap-3">
            <span className="title text-xl text-blood-500">Infiltrator</span>
            <span className="label">Visitor {Math.min(view.current + 1, view.total)}/{view.total} at the window</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-24" title="The guard's trust — at 0 the survivors open the gate">
              <div className="flex justify-between font-mono text-[9px] uppercase text-ash-400"><span>Their trust</span><span>{view.trust}</span></div>
              <div className="h-1.5 bg-coal-700"><div className="h-full bg-sky-400 transition-all" style={{ width: `${view.trust}%` }} /></div>
            </div>
            <MuteButton />
          </div>
        </div>
        <div className="mt-2 flex gap-1.5">
          {Array.from({ length: view.total }, (_, i) => (
            <span key={i} className={cx('h-2 flex-1', i < view.current ? 'bg-ash-500' : i === view.current ? (view.atWindow ? 'bg-blood-500' : 'bg-warn-500') : 'bg-coal-700')} />
          ))}
        </div>
      </header>

      <div className="grid gap-3 lg:grid-cols-[1fr_1.15fr]">
        {/* live feed */}
        <div className="space-y-3">
          <Panel title={view.atWindow ? <span className="text-blood-400">You, through the guard's glass</span> : `Watching visitor #${view.current + 1}`}>
            <div className="relative aspect-[4/3] overflow-hidden border-[8px] border-[#4a4550] bg-[radial-gradient(ellipse_at_50%_30%,#4b4a5c_0%,#2c2a38_55%,#16151c_100%)]">
              {v && view.phase === 'visit' && <Portrait ap={v.appearance} className="absolute inset-x-0 bottom-0 mx-auto h-[95%]" />}
              {view.phase === 'between' && <p className="absolute inset-0 flex items-center justify-center font-display uppercase tracking-widest text-ash-400">Empty window</p>}
              {v && view.phase === 'visit' && v.exchanges.at(-1) && (
                <p className="absolute inset-x-2 bottom-2 text-center font-display text-lg text-white [text-shadow:0_2px_0_#000,2px_0_0_#000,-2px_0_0_#000]">
                  {v.exchanges.at(-1)!.answer ?? '…'}
                </p>
              )}
            </div>
            {v && view.phase === 'visit' && (
              <div className="mt-2 flex flex-wrap gap-1">
                {Object.values(v.tools).map((t) => <span key={t!.tool} className={cx('chip', `sev-${t!.severity}`)}>{t!.title}: {t!.lines[0].slice(0, 40)}</span>)}
              </div>
            )}
          </Panel>
          <Panel title="What you hear"><LogFeed log={view.log} /></Panel>
        </div>

        {/* control */}
        <div className="space-y-3">
          {!view.arrived ? (
            <>
              <Panel title="1 · Steal a face" right={<span className="label text-blood-400">The guard can't see this</span>}>
                <div className="grid gap-2 sm:grid-cols-3">
                  {view.identityOptions.map((o) => (
                    <button key={o.key} onClick={() => { sfx.click(); setIdentity(o.key); }}
                      className={cx('border-2 p-2 text-left transition', identity === o.key ? 'border-blood-500 bg-blood-900/40' : 'border-coal-600 bg-coal-850 hover:border-ash-400')}>
                      <div className="flex gap-1">
                        <div className="h-16 w-14 overflow-hidden border border-coal-500 bg-[#2c2a38]"><Portrait ap={faceOnly(o.look)} className="h-full w-full" mini showHands={false} crop /></div>
                        <div className="h-16 w-12 overflow-hidden border border-coal-500 bg-[#9fb1c4]" title="ID photo"><Portrait ap={faceOnly(o.card.photo)} className="h-full w-full" mini showHands={false} crop /></div>
                      </div>
                      <p className="title mt-1 text-sm">{o.card.name}</p>
                      <p className={cx('font-mono text-[10px] uppercase', o.record.status === 'missing' ? 'text-blood-400' : o.record.status === 'none' ? 'text-warn-400' : 'text-safe-400')}>{o.label}</p>
                      <p className="mt-1 text-[11px] leading-snug text-ash-400">{o.risk}</p>
                    </button>
                  ))}
                </div>
              </Panel>

              <Panel title={`2 · Hide your rot (pick ${CONFIG.zombieCovers})`}>
                <ul className="mb-3 space-y-1">
                  {view.anomalies.map((a) => (
                    <li key={a} className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-ash-200">{ANOMALY_TEXT[a]}</span>
                      <span className={cx('chip', covered(a) ? 'sev-normal' : 'sev-alarming')}>{covered(a) ? 'covered' : 'exposed'}</span>
                    </li>
                  ))}
                </ul>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(COVERS) as Cover[]).map((c) => (
                    <button key={c} onClick={() => toggleCover(c)}
                      className={cx('border-2 p-2 text-left', covers.includes(c) ? 'border-warn-400 bg-warn-600/20' : 'border-coal-600 bg-coal-850 hover:border-ash-400')}>
                      <p className="title text-sm">{COVERS[c].name}{view.anomalies.includes(COVERS[c].hides) ? '' : <span className="ml-1 font-mono text-[10px] normal-case text-ash-400">(decoy)</span>}</p>
                      <p className="text-[11px] leading-snug text-ash-400">{COVERS[c].text}</p>
                    </button>
                  ))}
                </div>
                <button className="btn-red mt-3 w-full" disabled={busy || !dirty} onClick={() => run({ type: 'prepare', identity, covers }, sfx.stamp)}>
                  {view.prepared ? (dirty ? 'Update disguise' : 'Disguise locked in') : 'Lock in disguise'}
                </button>
              </Panel>

              <Panel title="3 · Choose your moment">
                <p className="text-sm text-ash-300">
                  {view.queued
                    ? <>You're next in line. You'll be <b className="text-blood-400">visitor #{nextSlot}</b>.</>
                    : <>Wait in the shadows and watch how the guard works. You <b>must</b> arrive by visitor #{view.mustEnterBy}.</>}
                </p>
                <button className={cx('mt-3 w-full', view.queued ? 'btn-ghost' : 'btn-red')} disabled={busy || !view.prepared || view.current < 0}
                  onClick={() => run({ type: 'queue', on: !view.queued }, sfx.heartbeat)}>
                  {!view.prepared ? 'Lock in a disguise first' : view.queued ? 'Step back into the shadows' : 'Step into line — I go next'}
                </button>
              </Panel>

              <Panel title="Sabotage · hits the NEXT visit">
                <div className="grid gap-2 sm:grid-cols-3">
                  {(Object.keys(SABOTAGE) as Sabotage[]).map((k) => (
                    <button key={k} disabled={busy || view.sabotage[k] <= 0 || view.pendingSabotage.includes(k)} onClick={() => run({ type: 'sabotage', kind: k }, sfx.siren)}
                      className="border-2 border-coal-600 bg-coal-850 p-2 text-left hover:border-blood-500 disabled:opacity-40">
                      <p className="title text-sm">{SABOTAGE[k].name}</p>
                      <p className="text-[11px] leading-snug text-ash-400">{view.pendingSabotage.includes(k) ? 'Armed for the next visitor.' : SABOTAGE[k].text}</p>
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-ash-400">Use it on yourself, or waste the guard's time on an innocent to make them doubt everything.</p>
              </Panel>
            </>
          ) : (
            <>
              <Panel title={view.atWindow ? <span className="text-blood-400">You are at the window</span> : 'Your disguise'} className="!border-blood-700">
                {(() => {
                  const o = view.identityOptions.find((x) => x.key === view.chosen)!;
                  return (
                    <div>
                      <p className="title text-2xl">{o.card.name}</p>
                      <p className="font-mono text-xs text-ash-400">{o.card.idNumber} · {o.label}</p>
                      <ul className="mt-3 grid gap-1 font-mono text-[13px] sm:grid-cols-2">
                        {(Object.keys(FACT_LABEL) as FactKey[]).map((f) => (
                          <li key={f} className="flex justify-between gap-2 border-b border-coal-700 pb-1">
                            <span className="text-ash-400">{FACT_LABEL[f]}</span>
                            <span className={view.memory[f] ? 'text-ash-100' : 'text-blood-400'}>{view.memory[f] ?? '— lost —'}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })()}
              </Panel>
              <Panel title="Your rot">
                <ul className="space-y-1">
                  {view.anomalies.map((a) => (
                    <li key={a} className="flex items-center justify-between gap-2 text-sm">
                      <span>{ANOMALY_TEXT[a]}</span>
                      <span className={cx('chip', view.exposed.includes(a) ? 'sev-alarming' : covered(a) ? 'sev-normal' : 'sev-odd')}>
                        {view.exposed.includes(a) ? 'they saw it' : covered(a) ? 'covered' : 'not seen yet'}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-ash-400">Refusing an order is allowed. Humans refuse too, sometimes. Make it believable.</p>
              </Panel>
            </>
          )}
        </div>
      </div>

      <AnimatePresence>
        {p && (
          <motion.div className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 p-3 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="panel w-full max-w-lg !border-blood-500 p-4" initial={{ y: 40 }} animate={{ y: 0 }}>
              <div className="flex items-center justify-between">
                <p className="label text-blood-400">{p.kind === 'request' ? 'The guard orders' : 'The guard asks'}</p>
                <Countdown deadline={p.deadline} now={now} total={CONFIG.answerTimeoutMs} />
              </div>
              <p className="title mt-2 text-2xl normal-case">“{p.text}”</p>
              {p.kind === 'request' && <p className="mt-1 text-xs text-ash-400">First option: comply (they will see it). Others: refuse with an excuse.</p>}
              <div className="mt-4 grid gap-2">
                {p.options.map((o, i) => (
                  <button key={i} disabled={busy} onClick={() => run({ type: 'respond', exchangeId: p.exchangeId, option: i }, sfx.click)}
                    className={cx('btn-ghost !justify-start !py-3 text-left !font-body !text-[15px] !normal-case !tracking-normal', p.kind === 'request' && i === 0 && '!border-warn-500', p.kind === 'request' && i > 0 && '!text-ash-300')}>
                    {p.kind === 'request' && <span className="mr-2 font-mono text-[10px] uppercase text-ash-400">{i === 0 ? 'comply' : 'refuse'}</span>}
                    “{o}”
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
