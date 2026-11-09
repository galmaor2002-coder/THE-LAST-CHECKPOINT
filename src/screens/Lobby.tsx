import { motion } from 'framer-motion';
import { useState } from 'react';
import type { RoomRow } from '../lib/api';
import { cx, inviteUrl } from '../lib/util';
import { sfx } from '../lib/sound';
import { Banner, MuteButton, Panel } from '../components/ui';

function Slot({ n, name, joined, online, me }: { n: number; name: string | null; joined: boolean; online: boolean; me: boolean }) {
  return (
    <div className={cx('flex items-center justify-between border px-3 py-3', joined ? 'border-coal-500 bg-coal-800/60' : 'border-dashed border-coal-600')}>
      <div>
        <p className="label">Player {n}{n === 1 ? ' · Host' : ''}{me ? ' · You' : ''}</p>
        <p className="title mt-0.5 text-lg">{joined ? name : 'Waiting for opponent…'}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className={cx('h-2.5 w-2.5 rounded-full', joined && online ? 'bg-safe-500 shadow-[0_0_10px_#3fa365]' : joined ? 'bg-warn-500' : 'animate-pulse bg-coal-500')} />
        <span className={cx('font-mono text-xs uppercase', joined && online ? 'text-safe-400' : 'text-ash-400')}>
          {joined ? (online ? 'Connected' : 'Reconnecting') : 'Empty'}
        </span>
      </div>
    </div>
  );
}

export function Lobby({
  room, uid, online, onStart, onLeave, starting, error,
}: {
  room: RoomRow; uid: string; online: Record<string, boolean>; onStart: () => void; onLeave: () => void; starting: boolean; error: string | null;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const isHost = room.host_id === uid;
  const url = inviteUrl(room.code);
  const bothHere = !!room.guest_id && online[room.host_id] && online[room.guest_id];

  const copy = async (text: string, what: string) => {
    sfx.click();
    try { await navigator.clipboard.writeText(text); setCopied(what); setTimeout(() => setCopied(null), 1800); } catch { setCopied('Copy failed — select the text manually'); }
  };
  const share = async () => {
    sfx.click();
    if (navigator.share) {
      try { await navigator.share({ title: 'THE LAST CHECKPOINT', text: 'One of them is not human. Join my game:', url }); } catch { /* cancelled */ }
    } else void copy(url, 'Link copied');
  };

  return (
    <main className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-5 py-10">
      <div className="mb-6 flex items-center justify-between">
        <button className="label hover:text-ash-100" onClick={onLeave}>← Leave</button>
        <MuteButton />
      </div>
      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
        <Panel title="Private channel" right={<span className="label text-safe-400">Encrypted · 2 slots</span>}>
          <p className="label">Room code</p>
          <button onClick={() => copy(room.code, 'Code copied')} className="mt-1 w-full text-left font-display text-5xl tracking-[0.35em] text-ash-100 sm:text-6xl" aria-label="Copy room code">
            {room.code}
          </button>
          <p className="mt-2 break-all font-mono text-xs text-ash-400">{url}</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button className="btn-ghost" onClick={() => copy(url, 'Invite link copied')}>Copy link</button>
            <button className="btn-ghost" onClick={share}>Share invite</button>
          </div>
          {copied && <p className="mt-2 font-mono text-xs text-safe-400">{copied}</p>}
        </Panel>

        <div className="mt-4 space-y-2">
          <Slot n={1} name={room.host_name} joined online={!!online[room.host_id]} me={room.host_id === uid} />
          <Slot n={2} name={room.guest_name} joined={!!room.guest_id} online={!!room.guest_id && !!online[room.guest_id]} me={room.guest_id === uid} />
        </div>

        <div className="mt-6">
          {isHost ? (
            <button className="btn-red w-full !py-4 !text-lg" disabled={!bothHere || starting} onClick={onStart}>
              {starting ? 'Assigning roles…' : room.match_count > 0 ? 'Start next match' : 'Start Game'}
            </button>
          ) : (
            <Banner tone="info">Connected. Waiting for the host to start the match…</Banner>
          )}
          {isHost && !room.guest_id && <p className="mt-3 text-center text-sm text-ash-400">Send the link through WhatsApp, Discord or anything else.</p>}
          {error && <div className="mt-3"><Banner tone="danger">{error}</Banner></div>}
        </div>
      </motion.div>
    </main>
  );
}
