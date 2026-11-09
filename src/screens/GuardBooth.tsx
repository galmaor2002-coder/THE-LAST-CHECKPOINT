// The guard's first-person checkpoint booth: window in the middle, desk with interactive tools at the bottom.
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { AnyAction, GuardView, RequestId, ToolId } from '@engine/types.ts';
import { GUIDE, REQUESTS } from '@engine/data.ts';
import { cx } from '../lib/util';
import { sfx } from '../lib/sound';
import { Portrait, faceOnly } from '../components/Portrait';
import { BookIcon, IdIcon, MicIcon, MonitorIcon, PhoneIcon, StampsIcon, ToolsIcon } from '../components/DeskIcons';
import { MuteButton } from '../components/ui';

type PanelId = 'computer' | 'id' | 'phone' | 'guide' | 'tools' | 'talk' | 'stamp' | null;

const SEV = { normal: 'text-safe-400', odd: 'text-warn-400', alarming: 'text-blood-400' } as const;

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <motion.div
      className="absolute inset-x-2 bottom-2 top-2 z-30 flex flex-col overflow-hidden border-2 border-black bg-[#e9e3d2] text-coal-900 shadow-[0_20px_60px_rgba(0,0,0,0.7)] sm:inset-x-auto sm:left-1/2 sm:w-[560px] sm:-translate-x-1/2"
      initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
    >
      <header className="flex items-center justify-between border-b-2 border-black bg-[#d8d0b9] px-3 py-2">
        <h3 className="font-display text-lg uppercase tracking-wider">{title}</h3>
        <button onClick={onClose} className="h-8 w-8 border-2 border-black bg-white font-display text-lg leading-none hover:bg-coal-200" aria-label="Close">×</button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">{children}</div>
    </motion.div>
  );
}

function DeskItem({ label, sub, onClick, active, children, className }: { label: string; sub?: string; onClick: () => void; active?: boolean; children: ReactNode; className?: string }) {
  return (
    <button onClick={() => { sfx.click(); onClick(); }}
      className={cx('group relative flex h-full min-h-0 flex-col items-center justify-center rounded-sm px-1 py-1 transition hover:-translate-y-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-warn-400', active && '-translate-y-1', className)}>
      <div className={cx('min-h-0 w-full flex-1 drop-shadow-[0_6px_6px_rgba(0,0,0,0.6)]', active && 'drop-shadow-[0_0_12px_rgba(245,158,66,0.8)]')}>{children}</div>
      <span className="mt-1 shrink-0 whitespace-nowrap font-mono text-[10px] uppercase tracking-wider text-ash-100 sm:text-[11px]">{label}</span>
      {sub && <span className="font-mono text-[9px] text-warn-400 sm:text-[10px]">{sub}</span>}
    </button>
  );
}

export function GuardBooth({ view, act, now }: { view: GuardView; act: (a: AnyAction) => Promise<boolean>; now: number }) {
  const [panel, setPanel] = useState<PanelId>(null);
  const [busy, setBusy] = useState(false);
  const [free, setFree] = useState('');
  const [stampFx, setStampFx] = useState<null | 'approve' | 'deny'>(null);
  const v = view.visitor;
  const visiting = view.phase === 'visit';
  const last = v?.exchanges.at(-1);
  const prevAnswered = useRef<number | null>(null);

  useEffect(() => { setPanel(null); setFree(''); }, [v?.id]);
  useEffect(() => {
    const done = last && !last.pending ? last.id : null;
    if (done && done !== prevAnswered.current && last?.kind !== 'greeting') sfx.beep();
    prevAnswered.current = done;
  }, [last?.id, last?.pending]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (a: AnyAction, sound?: () => void) => {
    if (busy) return false;
    setBusy(true); sound?.();
    const ok = await act(a);
    setBusy(false);
    return ok;
  };
  const tool = (t: ToolId) => view.tools.find((x) => x.id === t)!;
  const applyTool = (t: ToolId) => run({ type: 'tool', tool: t }, t === 'database' ? sfx.scan : sfx.click);
  const decide = async (d: 'approve' | 'deny') => {
    const ok = await run({ type: 'decide', decision: d }, sfx.stamp);
    if (ok) { setStampFx(d); setPanel(null); setTimeout(() => setStampFx(null), 1400); }
  };

  const subtitle = (() => {
    if (!v || !visiting) return null;
    if (!last) return null;
    if (last.pending) return { you: last.guardLine, them: '…' };
    return { you: last.kind === 'greeting' ? null : last.guardLine, them: last.answer ?? '' };
  })();

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[#121014]">
      {/* HUD */}
      <div className="z-20 flex items-center justify-between gap-2 border-b border-black bg-[#0c0b0d] px-3 py-1.5">
        <div className="flex items-center gap-1.5" aria-label={`Visitor ${view.current + 1} of ${view.total}`}>
          {Array.from({ length: view.total }, (_, i) => (
            <span key={i} className={cx('h-2.5 w-2.5 rotate-45 border', i < view.current ? 'border-ash-400 bg-ash-400' : i === view.current ? 'border-warn-400 bg-warn-500' : 'border-coal-500')} />
          ))}
          <span className="label ml-2 hidden sm:inline">Visitor {Math.min(view.current + 1, view.total)}/{view.total}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1" title="Actions left for this visitor">
            {Array.from({ length: view.actionsMax }, (_, i) => (
              <span key={i} className={cx('h-3 w-1.5 skew-x-[-12deg]', i < view.actions ? 'bg-warn-500 shadow-[0_0_6px_rgba(224,122,31,0.8)]' : 'bg-coal-600')} />
            ))}
          </div>
          <div className="w-20 sm:w-28" title="Trust">
            <div className="flex justify-between font-mono text-[9px] uppercase text-ash-400"><span>Trust</span><span>{view.trust}</span></div>
            <div className="h-1.5 bg-coal-700"><div className={cx('h-full transition-all', view.trust <= 25 ? 'bg-blood-500' : 'bg-sky-400')} style={{ width: `${view.trust}%` }} /></div>
          </div>
          <MuteButton />
        </div>
      </div>

      {/* Booth + window */}
      <div className="relative min-h-0 flex-1 bg-[linear-gradient(#2a2430,#1a161d)] px-3 pt-3 sm:px-8 sm:pt-5">
        <div className="pointer-events-none absolute left-3 top-4 hidden h-10 w-10 rounded-full border-4 border-black bg-[#3a3540] sm:block" />
        <div className="pointer-events-none absolute right-6 top-6 hidden h-24 w-16 rotate-3 border-2 border-black bg-[#e9e3d2] p-1 font-mono text-[7px] leading-tight text-coal-800 lg:block">
          CHECKPOINT 7<br />— NO ENTRY W/O ID<br />— CHECK EYES<br />— CHECK GUMS<br />— TRUST NO ONE
        </div>
        <div className="relative mx-auto flex h-full max-w-4xl flex-col">
          {/* window frame */}
          <div className="relative min-h-0 flex-1 border-[10px] border-[#4a4550] bg-black shadow-[inset_0_0_0_4px_#000,0_0_0_4px_#000] sm:border-[14px]">
            {/* exterior night */}
            <div className="absolute inset-0 overflow-hidden bg-[radial-gradient(ellipse_at_50%_30%,#4b4a5c_0%,#2c2a38_55%,#16151c_100%)]">
              <div className="absolute inset-x-0 bottom-0 h-1/3 bg-[linear-gradient(to_top,#1d1c22,transparent)]" />
              <div className="absolute inset-0 opacity-30 [background:repeating-linear-gradient(105deg,transparent_0_18px,rgba(200,210,230,0.25)_18px_19px)] animate-[rainfall_0.6s_linear_infinite]" />
            </div>
            {/* visitor */}
            <AnimatePresence mode="wait">
              {v && visiting && (
                <motion.div key={v.id} className="absolute inset-x-0 bottom-0 mx-auto h-[96%] max-w-[560px]"
                  initial={{ x: '-70%', opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: v.decision === 'approve' ? '80%' : '-80%', opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 60, damping: 16 }}>
                  <div className="h-full w-full animate-[breathe_4s_ease-in-out_infinite]">
                    <Portrait ap={v.appearance} className="h-full w-full" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {/* glass */}
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.10)_0%,rgba(255,255,255,0.02)_30%,transparent_31%,transparent_60%,rgba(255,255,255,0.06)_61%,transparent_75%)]" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-[repeating-linear-gradient(90deg,#111_0_6px,#2a2a2a_6px_10px)] opacity-80" />

            {/* subtitles */}
            {subtitle && (
              <div className="pointer-events-none absolute inset-x-0 bottom-8 flex flex-col items-center gap-1 px-4 text-center">
                {subtitle.you && <p className="max-w-[90%] font-mono text-xs text-warn-400 [text-shadow:0_1px_2px_#000] sm:text-sm">You: “{subtitle.you}”</p>}
                <motion.p key={`${last?.id}-${subtitle.them}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  className={cx('max-w-[92%] font-display text-xl tracking-wide text-white sm:text-3xl [text-shadow:0_2px_0_#000,0_0_3px_#000,2px_0_0_#000,-2px_0_0_#000]', subtitle.them === '…' && 'animate-pulse')}>
                  {subtitle.them}
                </motion.p>
              </div>
            )}

            {/* between visitors */}
            {view.phase === 'between' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/30">
                <p className="font-display text-2xl uppercase tracking-widest text-ash-200">The window is empty</p>
                <p className="font-mono text-xs text-ash-400">{view.total - view.current - 1} visitor{view.total - view.current - 1 === 1 ? '' : 's'} left tonight</p>
                <button className="btn-red !px-8 !py-4 !text-lg" disabled={busy} onClick={() => run({ type: 'next_visitor' }, sfx.heartbeat)}>Next visitor</button>
              </div>
            )}

            {/* events */}
            {visiting && (view.active.phoneDead || view.active.dbDown || view.active.distracted) && (
              <div className="absolute left-2 top-2 space-y-1">
                {view.active.distracted && <span className="chip border-warn-500 bg-black/70 text-warn-400">Alarm: −2 actions</span>}
                {view.active.phoneDead && <span className="chip block border-blood-500 bg-black/70 text-blood-400">Phone line dead</span>}
                {view.active.dbDown && <span className="chip block border-blood-500 bg-black/70 text-blood-400">Database offline</span>}
              </div>
            )}

            {/* stamp effect */}
            <AnimatePresence>
              {stampFx && (
                <motion.div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
                  initial={{ scale: 2.2, opacity: 0, rotate: -18 }} animate={{ scale: 1, opacity: 1, rotate: -12 }} exit={{ opacity: 0 }}>
                  <span className={cx('border-[6px] px-6 py-2 font-display text-5xl font-bold uppercase tracking-widest sm:text-7xl', stampFx === 'approve' ? 'border-safe-500 text-safe-400' : 'border-blood-500 text-blood-500')}>
                    {stampFx === 'approve' ? 'Approved' : 'Denied'}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* panels open over the window */}
          <AnimatePresence>
            {panel && v && (
              <>
                {panel === 'computer' && (
                  <Sheet title="Civil registry terminal" onClose={() => setPanel(null)}>
                    <div className="min-h-[220px] border-2 border-black bg-[#0d1a12] p-3 font-mono text-sm text-[#5cf08a]">
                      <p>&gt; QUERY ID {v.card.idNumber}</p>
                      {v.tools.database ? (
                        <div className="mt-2 space-y-1">{v.tools.database.lines.map((l) => <p key={l} className={cx(/MISSING|NO RECORD/.test(l) && 'text-[#ff6b6b]')}>{l}</p>)}</div>
                      ) : (
                        <button className="mt-4 border border-[#5cf08a] px-3 py-2 hover:bg-[#5cf08a] hover:text-black disabled:opacity-40" disabled={busy || !tool('database').available} onClick={() => applyTool('database')}>
                          {tool('database').available ? `RUN SEARCH (${tool('database').cost} action)` : `UNAVAILABLE: ${tool('database').reason}`}
                        </button>
                      )}
                    </div>
                  </Sheet>
                )}
                {panel === 'id' && (
                  <Sheet title="Identity card" onClose={() => setPanel(null)}>
                    <div className="relative mx-auto max-w-md border-[3px] border-black bg-[linear-gradient(135deg,#f4eedb,#e2d8bc)] p-3 shadow-lg">
                      <div className="mb-2 flex items-center justify-between border-b-2 border-black pb-1 font-display text-sm uppercase tracking-widest">
                        <span>Survivor ID</span><span className="font-mono text-xs">{v.card.idNumber}</span>
                      </div>
                      <div className="flex gap-3">
                        <div className="h-32 w-28 shrink-0 overflow-hidden border-2 border-black bg-[#9fb1c4]">
                          <Portrait ap={faceOnly(v.card.photo)} className="h-full w-full" mini showHands={false} crop />
                        </div>
                        <dl className="grid flex-1 grid-cols-[auto_1fr] gap-x-2 gap-y-1 font-mono text-[13px]">
                          <dt className="text-coal-500">Name</dt><dd className="font-semibold">{v.card.name}</dd>
                          <dt className="text-coal-500">Born</dt><dd>{v.card.dob}</dd>
                          <dt className="text-coal-500">From</dt><dd>{v.card.origin}</dd>
                          <dt className="text-coal-500">Expires</dt><dd className={cx(v.card.expired && 'font-bold text-blood-600')}>{v.card.expires}</dd>
                        </dl>
                      </div>
                      {v.card.expired && <span className="absolute right-4 top-12 rotate-[-14deg] border-4 border-blood-600 px-2 font-display text-2xl uppercase text-blood-600 opacity-80">Expired</span>}
                    </div>
                    <p className="mt-3 text-center font-mono text-xs text-coal-600">Compare the photo with the face at the window. Photos get old — faces don't change THAT much.</p>
                  </Sheet>
                )}
                {panel === 'phone' && (
                  <Sheet title="Phone" onClose={() => setPanel(null)}>
                    {v.tools.phone ? (
                      <div className="space-y-2">
                        <p className="font-mono text-xs uppercase text-coal-500">{v.tools.phone.title}</p>
                        {v.tools.phone.lines.map((l) => <p key={l} className="border-l-4 border-coal-700 bg-white/60 p-3 text-[15px] italic">{l}</p>)}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-sm">Call the emergency contact registered to this ID. Run the database first to see who that is.</p>
                        <button className="btn border-black bg-[#8e2f1f] text-white disabled:opacity-40" disabled={busy || !tool('phone').available} onClick={() => applyTool('phone')}>
                          {tool('phone').available ? `Dial (${tool('phone').cost} actions)` : tool('phone').reason}
                        </button>
                      </div>
                    )}
                  </Sheet>
                )}
                {panel === 'guide' && (
                  <Sheet title="Field guide: spotting the infected" onClose={() => setPanel(null)}>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {GUIDE.map((g) => (
                        <div key={g.title} className="border-2 border-black bg-white/60 p-2">
                          <p className="font-display uppercase tracking-wide">{g.title}</p>
                          <p className="text-[13px] leading-snug">{g.body}</p>
                        </div>
                      ))}
                    </div>
                  </Sheet>
                )}
                {panel === 'tools' && (
                  <Sheet title="Inspection tools" onClose={() => setPanel(null)}>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {(['thermometer', 'flashlight'] as ToolId[]).map((t) => {
                        const info = tool(t);
                        const r = v.tools[t];
                        return (
                          <div key={t} className="border-2 border-black bg-white/60 p-3">
                            <p className="font-display uppercase">{info.name}</p>
                            {r ? (
                              r.lines.map((l) => <p key={l} className={cx('mt-1 font-mono text-lg font-semibold', r.severity === 'alarming' ? 'text-blood-600' : r.severity === 'odd' ? 'text-warn-600' : 'text-safe-600')}>{l}</p>)
                            ) : (
                              <button className="btn mt-2 w-full border-black bg-coal-800 text-white disabled:opacity-40" disabled={busy || !info.available} onClick={() => applyTool(t)}>
                                {info.available ? `Use (${info.cost} action)` : info.reason}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <p className="mt-3 font-mono text-xs text-coal-600">Normal: 36–37.5 °C. Rain chills people to ~35. The infected run colder.</p>
                  </Sheet>
                )}
                {panel === 'talk' && (
                  <Sheet title="Intercom" onClose={() => setPanel(null)}>
                    <div className="space-y-3">
                      <div className="max-h-44 space-y-1.5 overflow-y-auto border-2 border-black bg-white/60 p-2 text-sm">
                        {v.exchanges.map((e) => (
                          <div key={e.id}>
                            {e.guardLine && <p className="font-mono text-xs text-coal-600">You: {e.guardLine}</p>}
                            <p className={cx(e.pending && 'animate-pulse text-coal-500')}>{e.pending ? '…' : `“${e.answer}”`}{e.kind === 'request' && !e.pending && <span className={cx('ml-2 font-mono text-[10px] uppercase', e.complied ? 'text-safe-600' : 'text-blood-600')}>{e.complied ? 'complied' : 'refused'}</span>}</p>
                          </div>
                        ))}
                      </div>
                      <div>
                        <p className="label !text-coal-600">Ask (1 action)</p>
                        <div className="mt-1 grid gap-1 sm:grid-cols-2">
                          {view.questions.map((q) => (
                            <button key={q.id} disabled={busy || q.asked || view.pending || view.actions < 1} onClick={() => run({ type: 'ask', question: q.id }, sfx.click)}
                              className={cx('border-2 border-black bg-white px-2 py-1.5 text-left text-[13px] hover:bg-warn-400/30 disabled:opacity-40', q.asked && 'line-through')}>
                              {q.text}
                            </button>
                          ))}
                        </div>
                      </div>
                      <form className="flex gap-1" onSubmit={async (e) => { e.preventDefault(); if (await run({ type: 'ask_free', text: free }, sfx.click)) setFree(''); }}>
                        <input value={free} maxLength={120} onChange={(e) => setFree(e.target.value)} placeholder="Type your own question…" className="min-w-0 flex-1 border-2 border-black bg-white px-2 py-2 text-sm outline-none focus:bg-warn-400/10" />
                        <button className="border-2 border-black bg-coal-800 px-3 font-display text-sm uppercase text-white disabled:opacity-40" disabled={busy || view.pending || free.trim().length < 2 || view.actions < 1}>Ask</button>
                      </form>
                      <div>
                        <p className="label !text-coal-600">Order them (1 action)</p>
                        <div className="mt-1 grid gap-1 sm:grid-cols-2">
                          {(Object.keys(REQUESTS) as RequestId[]).filter((r) => v.canRequest[r]).map((r) => (
                            <button key={r} disabled={busy || view.pending || view.actions < 1} onClick={() => run({ type: 'request', request: r }, sfx.alert)}
                              className="border-2 border-black bg-[#f3d9a4] px-2 py-1.5 text-left text-[13px] hover:bg-warn-400/50 disabled:opacity-40">
                              {REQUESTS[r]}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Sheet>
                )}
                {panel === 'stamp' && (
                  <Sheet title={`Decision — visitor #${view.current + 1}`} onClose={() => setPanel(null)}>
                    <p className="mb-4 text-center text-sm">Let them in, or send them back into the dark? Turning away innocent people costs trust.</p>
                    {view.pending && <p className="mb-3 text-center font-mono text-xs text-blood-600">Wait for their answer first.</p>}
                    <div className="grid grid-cols-2 gap-4">
                      <button disabled={busy || view.pending} onClick={() => decide('approve')} className="border-4 border-black bg-safe-600 py-6 font-display text-2xl uppercase tracking-widest text-white shadow-[4px_4px_0_#000] active:translate-y-1 disabled:opacity-40">Approve</button>
                      <button disabled={busy || view.pending} onClick={() => decide('deny')} className="border-4 border-black bg-blood-600 py-6 font-display text-2xl uppercase tracking-widest text-white shadow-[4px_4px_0_#000] active:translate-y-1 disabled:opacity-40">Deny</button>
                    </div>
                  </Sheet>
                )}
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Desk */}
      <div className="relative z-10 h-[30vh] min-h-[150px] max-h-[230px] border-t-4 border-black bg-[linear-gradient(#5b4a3b,#3d3128_60%,#2b231d)] shadow-[0_-10px_30px_rgba(0,0,0,0.6)]">
        <div className="absolute inset-x-0 top-0 h-3 bg-[#6e5a48]" />
        <div className="no-scrollbar mx-auto grid h-full max-w-5xl grid-cols-7 gap-0.5 overflow-x-auto px-1 pb-3 pt-5 sm:gap-2 sm:px-4">
          <DeskItem label="Computer" onClick={() => setPanel('computer')} active={panel === 'computer'} sub={v?.tools.database ? 'checked' : undefined}><MonitorIcon on={!!v?.tools.database} /></DeskItem>
          <DeskItem label="ID card" onClick={() => setPanel('id')} active={panel === 'id'}><IdIcon /></DeskItem>
          <DeskItem label="Phone" onClick={() => setPanel('phone')} active={panel === 'phone'} sub={v?.tools.phone ? 'called' : view.active.phoneDead ? 'dead' : undefined}><PhoneIcon dead={view.active.phoneDead} /></DeskItem>
          <DeskItem label="Intercom" onClick={() => setPanel('talk')} active={panel === 'talk'} sub={view.pending ? '…' : undefined}><MicIcon /></DeskItem>
          <DeskItem label="Tools" onClick={() => setPanel('tools')} active={panel === 'tools'}><ToolsIcon /></DeskItem>
          <DeskItem label="Guide" onClick={() => setPanel('guide')} active={panel === 'guide'}><BookIcon /></DeskItem>
          <DeskItem label="Decide" onClick={() => setPanel('stamp')} active={panel === 'stamp'}><StampsIcon /></DeskItem>
        </div>
        {!visiting && <div className="absolute inset-0 bg-black/40" />}
      </div>
    </div>
  );
}
