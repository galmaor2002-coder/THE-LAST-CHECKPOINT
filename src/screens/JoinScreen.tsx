import { useState } from 'react';
import { getName, navigate, setName } from '../lib/util';
import { sfx, unlockAudio } from '../lib/sound';

export function JoinScreen() {
  const [code, setCode] = useState('');
  const [name, setN] = useState(getName());
  const valid = /^[A-Z0-9]{6}$/.test(code);
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center px-5 py-10">
      <button className="label mb-8 self-start hover:text-ash-100" onClick={() => navigate('/')}>← Back</button>
      <h2 className="title text-4xl">Join Game</h2>
      <p className="mt-2 text-ash-400">Enter the 6-character room code your friend sent you, or just open their invite link.</p>
      <form
        className="mt-6 space-y-3"
        onSubmit={(e) => { e.preventDefault(); if (!valid) return; unlockAudio(); sfx.click(); setName(name); navigate(`/room/${code}`); }}
      >
        <label className="block">
          <span className="label">Room code</span>
          <input
            className="input mt-1 text-center font-display !text-3xl tracking-[0.5em]"
            autoFocus maxLength={6} inputMode="text" autoCapitalize="characters" autoComplete="off" placeholder="XXXXXX"
            value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          />
        </label>
        <label className="block">
          <span className="label">Callsign</span>
          <input className="input mt-1" maxLength={20} placeholder="Your name" value={name} onChange={(e) => setN(e.target.value)} />
        </label>
        <button className="btn-red w-full !py-4 !text-lg" disabled={!valid}>Enter Room</button>
      </form>
    </main>
  );
}
