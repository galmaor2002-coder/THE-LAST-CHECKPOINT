import { motion, AnimatePresence } from 'framer-motion';
import type { ReactNode } from 'react';
import { cx } from '../lib/util';
import { isMuted, setMuted, sfx } from '../lib/sound';
import { useState } from 'react';

export function Panel({ children, className, title, right }: { children: ReactNode; className?: string; title?: ReactNode; right?: ReactNode }) {
  return (
    <section className={cx('panel p-3 sm:p-4', className)}>
      {(title || right) && (
        <header className="mb-3 flex items-center justify-between gap-2 border-b border-coal-700 pb-2">
          <h3 className="label text-ash-300">{title}</h3>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

export function Countdown({ deadline, now, total }: { deadline: number; now: number; total: number }) {
  const left = Math.max(0, Math.ceil((deadline - now) / 1000));
  const pct = Math.max(0, Math.min(1, (deadline - now) / total));
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 w-20 bg-coal-700">
        <div className={cx('h-full transition-[width] duration-200', left <= 10 ? 'bg-blood-500' : 'bg-warn-500')} style={{ width: `${pct * 100}%` }} />
      </div>
      <span className={cx('font-mono text-xs', left <= 10 ? 'text-blood-400' : 'text-ash-300')}>{left}s</span>
    </div>
  );
}

export function LogFeed({ log, className }: { log: { t: number; text: string; kind: string }[]; className?: string }) {
  const items = [...log].reverse().slice(0, 14);
  const color: Record<string, string> = {
    info: 'text-ash-300', warn: 'text-warn-400', danger: 'text-blood-400', good: 'text-safe-400', event: 'text-warn-400',
  };
  return (
    <ol className={cx('space-y-1.5 font-mono text-[12px] leading-snug', className)}>
      <AnimatePresence initial={false}>
        {items.map((l, i) => (
          <motion.li key={`${l.t}-${l.text}-${i}`} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className={color[l.kind] ?? 'text-ash-300'}>
            <span className="mr-2 text-coal-500">{new Date(l.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            {l.text}
          </motion.li>
        ))}
      </AnimatePresence>
    </ol>
  );
}

export function MuteButton() {
  const [m, setM] = useState(isMuted());
  return (
    <button
      className="label rounded-none border border-coal-600 px-2 py-1 hover:text-ash-100"
      onClick={() => { setMuted(!m); setM(!m); if (m) sfx.click(); }}
      aria-label={m ? 'Unmute sound' : 'Mute sound'}
    >
      {m ? 'Sound off' : 'Sound on'}
    </button>
  );
}

export function Toast({ msg, onDone }: { msg: string | null; onDone: () => void }) {
  return (
    <AnimatePresence>
      {msg && (
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
          onAnimationComplete={() => setTimeout(onDone, 2800)}
          className="fixed inset-x-3 bottom-4 z-50 mx-auto max-w-md border border-blood-500 bg-coal-900/95 px-4 py-3 font-mono text-sm text-blood-400 shadow-2xl sm:bottom-6"
          role="alert"
        >
          {msg}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Banner({ children, tone = 'warn' }: { children: ReactNode; tone?: 'warn' | 'danger' | 'info' }) {
  const t = { warn: 'border-warn-500/70 bg-warn-600/15 text-warn-400', danger: 'border-blood-500 bg-blood-800/40 text-blood-400', info: 'border-coal-500 bg-coal-800/60 text-ash-200' }[tone];
  return <div className={cx('border px-3 py-2 font-mono text-xs sm:text-sm', t)}>{children}</div>;
}
