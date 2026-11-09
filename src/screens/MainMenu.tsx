import { motion } from 'framer-motion';
import { useState } from 'react';
import { createRoom } from '../lib/api';
import { isConfigured } from '../lib/supabase';
import { getName, navigate, setName } from '../lib/util';
import { sfx, unlockAudio } from '../lib/sound';
import { Banner, MuteButton } from '../components/ui';

export function MainMenu() {
  const [name, setN] = useState(getName());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rules, setRules] = useState(false);

  const create = async () => {
    unlockAudio(); sfx.click();
    setErr(null); setBusy(true);
    try {
      setName(name);
      const room = await createRoom(name || 'Player 1');
      navigate(`/room/${room.code}`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-full max-w-xl flex-col justify-center px-5 py-10">
      <div className="absolute right-4 top-4"><MuteButton /></div>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.2 }}>
        <p className="label mb-3 text-blood-400">Quarantine Zone 7 · Night shift</p>
        <h1 className="font-display text-5xl font-bold uppercase leading-[0.9] tracking-[0.04em] text-ash-100 sm:text-7xl">
          The Last<br /><span className="animate-flicker text-blood-500 [text-shadow:0_0_30px_rgba(201,35,42,0.6)]">Checkpoint</span>
        </h1>
        <p className="mt-4 max-w-md text-ash-300">Three survivors at the gate. One of them is not human. A 1v1 game of deception for two players, anywhere.</p>
      </motion.div>

      {!isConfigured && (
        <div className="mt-6">
          <Banner tone="danger">
            Online multiplayer is not configured yet. Set <b>VITE_SUPABASE_URL</b> and <b>VITE_SUPABASE_ANON_KEY</b> — see README → Supabase setup.
          </Banner>
        </div>
      )}

      <motion.div className="mt-8 space-y-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
        <label className="block">
          <span className="label">Callsign</span>
          <input className="input mt-1" maxLength={20} placeholder="Your name" value={name} onChange={(e) => setN(e.target.value)} />
        </label>
        <button className="btn-red w-full !py-4 !text-lg" disabled={busy || !isConfigured} onClick={create}>
          {busy ? 'Opening channel…' : 'Create Game'}
        </button>
        <button className="btn-ghost w-full !py-4 !text-lg" disabled={!isConfigured} onClick={() => { unlockAudio(); sfx.click(); setName(name); navigate('/join'); }}>
          Join Game
        </button>
        {err && <Banner tone="danger">{err}</Banner>}
      </motion.div>

      <button className="label mt-8 self-start underline-offset-4 hover:underline" onClick={() => setRules(!rules)}>
        {rules ? 'Hide briefing' : 'How to play'}
      </button>
      {rules && (
        <div className="panel mt-3 space-y-2 p-4 text-sm text-ash-300">
          <p><b className="text-ash-100">Guard:</b> you sit in the checkpoint booth. Six visitors come to your window, one at a time. Read their ID, search the registry, call their family, ask questions, order them to show their eyes, gums and hands. Then stamp APPROVE or DENY.</p>
          <p><b className="text-ash-100">Infiltrator:</b> you are one of the six. Steal an identity, hide your rot, pick the moment to step into line, sabotage the guard's tools, and talk your way in.</p>
          <p className="text-ash-400">One night shift · about 10 minutes · roles are random.</p>
        </div>
      )}
    </main>
  );
}
