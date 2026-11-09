// Hand-drawn style desk objects (inline SVG, thick ink outlines).
const INK = '#141414';

export function MonitorIcon({ on }: { on?: boolean }) {
  return (
    <svg viewBox="0 0 120 100" className="h-full w-full">
      <rect x="8" y="6" width="104" height="66" rx="6" fill="#c9c3b3" stroke={INK} strokeWidth="4" />
      <rect x="17" y="14" width="86" height="50" rx="3" fill={on ? '#0f2a17' : '#1b2320'} stroke={INK} strokeWidth="3" />
      {on && <path d="M24 26h40M24 36h60M24 46h30" stroke="#5cf08a" strokeWidth="3" />}
      <path d="M48 72 L44 88 H76 L72 72" fill="#b5ae9c" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      <rect x="30" y="86" width="60" height="8" rx="3" fill="#a59f8d" stroke={INK} strokeWidth="3" />
    </svg>
  );
}

export function IdIcon() {
  return (
    <svg viewBox="0 0 120 100" className="h-full w-full">
      <rect x="20" y="30" width="86" height="56" rx="5" fill="#e8e1cf" stroke={INK} strokeWidth="4" transform="rotate(8 63 58)" />
      <rect x="10" y="20" width="86" height="56" rx="5" fill="#f3eddc" stroke={INK} strokeWidth="4" transform="rotate(-6 53 48)" />
      <g transform="rotate(-6 53 48)">
        <rect x="18" y="30" width="24" height="30" rx="2" fill="#b8c6d6" stroke={INK} strokeWidth="3" />
        <circle cx="30" cy="40" r="6" fill="#e3b48f" stroke={INK} strokeWidth="2" />
        <path d="M50 34h36M50 44h30M50 54h36" stroke="#6b6658" strokeWidth="3" />
      </g>
    </svg>
  );
}

export function PhoneIcon({ dead }: { dead?: boolean }) {
  return (
    <svg viewBox="0 0 120 100" className="h-full w-full">
      <path d="M18 56 Q16 40 34 38 L86 38 Q104 40 102 56 L98 86 Q96 92 88 92 H32 Q24 92 22 86 Z" fill={dead ? '#5a5a5a' : '#8e2f1f'} stroke={INK} strokeWidth="4" />
      <circle cx="60" cy="66" r="14" fill="#e8e1cf" stroke={INK} strokeWidth="3" />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <circle key={i} cx={60 + Math.cos(i * 0.785) * 9} cy={66 + Math.sin(i * 0.785) * 9} r="2" fill={INK} />)}
      <path d="M14 30 Q14 14 30 16 L44 18 Q48 26 40 30 L34 30 Q34 36 40 38 L80 38 Q86 36 86 30 L80 30 Q72 26 76 18 L90 16 Q106 14 106 30" fill={dead ? '#5a5a5a' : '#8e2f1f'} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      {dead && <path d="M100 10 L112 22 M112 10 L100 22" stroke="#e5484d" strokeWidth="4" />}
    </svg>
  );
}

export function BookIcon() {
  return (
    <svg viewBox="0 0 120 100" className="h-full w-full">
      <path d="M14 22 Q38 14 60 24 Q82 14 106 22 V84 Q82 76 60 86 Q38 76 14 84 Z" fill="#3f5a3a" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      <path d="M60 24 V86" stroke={INK} strokeWidth="4" />
      <path d="M24 36 Q38 32 50 38 M24 48 Q38 44 50 50 M70 38 Q82 32 96 36" stroke="#d9d2bd" strokeWidth="3" fill="none" />
      <circle cx="80" cy="58" r="10" fill="none" stroke="#e5484d" strokeWidth="3" />
      <path d="M74 58h12M80 52v12" stroke="#e5484d" strokeWidth="3" />
    </svg>
  );
}

export function ToolsIcon() {
  return (
    <svg viewBox="0 0 120 100" className="h-full w-full">
      <rect x="12" y="60" width="96" height="26" rx="5" fill="#6b6f75" stroke={INK} strokeWidth="4" />
      <rect x="20" y="20" width="12" height="54" rx="6" fill="#eef1f3" stroke={INK} strokeWidth="4" transform="rotate(-20 26 47)" />
      <circle cx="35" cy="70" r="7" fill="#e5484d" stroke={INK} strokeWidth="3" />
      <rect x="58" y="34" width="44" height="18" rx="5" fill="#d4a017" stroke={INK} strokeWidth="4" transform="rotate(12 80 43)" />
      <path d="M100 44 L114 36 L114 58 L100 52" fill="#fff6c9" stroke={INK} strokeWidth="3" transform="rotate(12 80 43)" />
    </svg>
  );
}

export function MicIcon() {
  return (
    <svg viewBox="0 0 120 100" className="h-full w-full">
      <rect x="44" y="8" width="32" height="50" rx="16" fill="#2b2f36" stroke={INK} strokeWidth="4" />
      <path d="M50 22h20M50 32h20M50 42h20" stroke="#5b6270" strokeWidth="3" />
      <path d="M32 44 Q32 72 60 72 Q88 72 88 44" fill="none" stroke={INK} strokeWidth="4" />
      <path d="M60 72 V88 M40 90 H80" stroke={INK} strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

export function StampIcon({ color }: { color: 'green' | 'red' }) {
  const c = color === 'green' ? '#2f7a4a' : '#a3191f';
  return (
    <svg viewBox="0 0 120 100" className="h-full w-full">
      <ellipse cx="60" cy="22" rx="18" ry="12" fill={c} stroke={INK} strokeWidth="4" />
      <rect x="52" y="22" width="16" height="30" fill={c} stroke={INK} strokeWidth="4" />
      <rect x="22" y="50" width="76" height="20" rx="4" fill={c} stroke={INK} strokeWidth="4" />
      <rect x="18" y="70" width="84" height="16" rx="3" fill="#2a2a2a" stroke={INK} strokeWidth="4" />
    </svg>
  );
}

export function StampsIcon() {
  return (
    <svg viewBox="0 0 120 100" className="h-full w-full">
      {([['#2f7a4a', 4], ['#a3191f', 62]] as const).map(([c, x]) => (
        <g key={x} transform={`translate(${x} 0)`}>
          <ellipse cx="27" cy="24" rx="14" ry="10" fill={c} stroke={INK} strokeWidth="4" />
          <rect x="21" y="24" width="12" height="26" fill={c} stroke={INK} strokeWidth="4" />
          <rect x="4" y="48" width="46" height="18" rx="4" fill={c} stroke={INK} strokeWidth="4" />
          <rect x="2" y="66" width="50" height="14" rx="3" fill="#2a2a2a" stroke={INK} strokeWidth="4" />
        </g>
      ))}
    </svg>
  );
}
