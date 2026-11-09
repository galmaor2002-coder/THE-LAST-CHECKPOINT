import { motion } from 'framer-motion';
import { useEffect } from 'react';
import type { Role } from '@engine/types.ts';
import { sfx } from '../lib/sound';

const COPY: Record<Role, { title: string; tag: string; lines: string[]; color: string }> = {
  guard: {
    title: 'The Guard',
    tag: 'Protect the building',
    color: 'text-ash-100',
    lines: [
      'Six visitors will reach your window tonight, one at a time. One of them is infected, wearing a human face.',
      'Check papers, call contacts, question them, order them to show their eyes, gums and hands. Every visit you only have a few actions.',
      'Deny the infected and you win. Approve it and the building falls. Turning away innocent people costs trust.',
    ],
  },
  zombie: {
    title: 'The Infiltrator',
    tag: 'Look human. Get stamped.',
    color: 'text-blood-500',
    lines: [
      'Steal a face, hide your rot, and choose when to step into the line. The guard never knows which visitor is you.',
      'At the window you choose every word, and whether to obey or refuse. Your stolen memories are full of holes.',
      'Get stamped APPROVED and you win. Sabotage the guard\'s tools while you wait.',
    ],
  },
};

export function RoleReveal({ role, matchNumber, onContinue }: { role: Role; matchNumber: number; onContinue: () => void }) {
  const c = COPY[role];
  useEffect(() => { role === 'zombie' ? sfx.sting() : sfx.heartbeat(); }, [role]);
  return (
    <main className="mx-auto flex min-h-full max-w-xl flex-col justify-center px-6 py-10">
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="label">Match {matchNumber} · Role assigned at random</motion.p>
      <motion.h2
        initial={{ opacity: 0, letterSpacing: '0.5em', filter: 'blur(8px)' }}
        animate={{ opacity: 1, letterSpacing: '0.06em', filter: 'blur(0px)' }}
        transition={{ duration: 1.4, ease: 'easeOut' }}
        className={`mt-3 font-display text-5xl font-bold uppercase sm:text-7xl ${c.color}`}
      >
        {c.title}
      </motion.h2>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="title mt-2 text-lg text-warn-400">{c.tag}</motion.p>
      <ul className="mt-6 space-y-3">
        {c.lines.map((l, i) => (
          <motion.li key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.3 + i * 0.3 }} className="border-l-2 border-blood-600 pl-3 text-ash-300">
            {l}
          </motion.li>
        ))}
      </ul>
      <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.4 }} className="btn-red mt-8 !py-4 !text-lg" onClick={() => { sfx.click(); onContinue(); }}>
        {role === 'guard' ? 'Open the window' : 'Prepare your disguise'}
      </motion.button>
    </main>
  );
}
