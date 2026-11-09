// Procedural, original cartoon faces with thick ink outlines.
// Every visual anomaly the guard can spot is drawn here from the server-computed Appearance.
import type { Appearance, Look } from '@engine/types.ts';

const INK = '#141414';
const SKIN = ['#f2d0b1', '#e3b48f', '#c98e65', '#a86f4c', '#7d4f35', '#f7dcc6'];
const SKIN_SHADE = ['#d9b08f', '#c79772', '#ad744f', '#8c5839', '#623b26', '#e2bfa6'];
const GREY = '#a3ab96';
const GREY_SHADE = '#7f8a74';
const HAIR = ['#1c1714', '#4a2f1d', '#8a5a2b', '#c9a15a', '#7a7a7a', '#8e2f1f'];
const IRIS = ['#5b8bb5', '#5d7a3e', '#6b4a2b', '#3d3d3d'];
const SHIRT = ['#4a5568', '#6b2f2f', '#2f4f3a', '#5c4a2e', '#3a3f6b', '#7a6a55'];

function pale(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * 0.35);
  const r = mix(n >> 16), g = mix((n >> 8) & 255), b = mix(n & 255);
  return `rgb(${r},${g},${b})`;
}

export function faceOnly(look: Look): Appearance {
  return { look, eyes: 'normal', skin: 'normal', sunglasses: false, neck: 'clear', mouth: null, hands: null };
}

export function Portrait({ ap, className, mini, showHands = true, crop }: { ap: Appearance; className?: string; mini?: boolean; showHands?: boolean; crop?: boolean }) {
  const L = ap.look;
  const skin = ap.skin === 'grey' ? GREY : ap.skin === 'pale' ? pale(SKIN[L.skin]) : SKIN[L.skin];
  const shade = ap.skin === 'grey' ? GREY_SHADE : SKIN_SHADE[L.skin];
  const hair = HAIR[L.hairColor];
  const shirt = SHIRT[L.shirt];
  const sw = mini ? 5 : 4;
  // head geometry
  const headW = [88, 80, 94][L.face];
  const headH = [104, 112, 98][L.face];
  const cx = 200, cy = 148;

  return (
    <svg viewBox={crop ? '85 10 230 280' : '0 0 400 400'} preserveAspectRatio="xMidYMid slice" className={className} role="img" aria-label="Visitor">
      {/* shoulders + shirt */}
      <path d={`M60 400 C70 320 120 292 200 288 C280 292 330 320 340 400 Z`} fill={shirt} stroke={INK} strokeWidth={sw} />
      <path d="M160 292 L200 340 L240 292" fill="#e9e6df" stroke={INK} strokeWidth={sw} strokeLinejoin="round" />
      {/* neck */}
      <path d={`M172 238 L172 296 Q200 312 228 296 L228 238 Z`} fill={skin} stroke={INK} strokeWidth={sw} />
      <path d="M172 262 Q200 274 228 262" fill="none" stroke={shade} strokeWidth="6" opacity="0.6" />
      {/* ears */}
      <ellipse cx={cx - headW + 4} cy={cy + 8} rx="14" ry="20" fill={skin} stroke={INK} strokeWidth={sw} />
      <ellipse cx={cx + headW - 4} cy={cy + 8} rx="14" ry="20" fill={skin} stroke={INK} strokeWidth={sw} />

      {/* long hair behind head */}
      {L.hair === 2 && <path d={`M${cx - headW - 6} ${cy - 20} Q${cx - headW - 16} ${cy + 110} ${cx - headW + 20} ${cy + 120} L${cx + headW - 20} ${cy + 120} Q${cx + headW + 16} ${cy + 110} ${cx + headW + 6} ${cy - 20} Z`} fill={hair} stroke={INK} strokeWidth={sw} />}
      {L.hair === 3 && <circle cx={cx} cy={cy - headH - 6} r="30" fill={hair} stroke={INK} strokeWidth={sw} />}

      {/* head */}
      <ellipse cx={cx} cy={cy} rx={headW} ry={headH} fill={skin} stroke={INK} strokeWidth={sw} />
      <path d={`M${cx - headW + 14} ${cy + 40} Q${cx} ${cy + headH + 10} ${cx + headW - 14} ${cy + 40}`} fill="none" stroke={shade} strokeWidth="10" opacity="0.35" />

      {/* hair */}
      {L.hair === 0 && <path d={`M${cx - headW + 2} ${cy - 20} Q${cx - headW} ${cy - headH - 18} ${cx} ${cy - headH - 8} Q${cx + headW} ${cy - headH - 18} ${cx + headW - 2} ${cy - 20} Q${cx + 30} ${cy - 70} ${cx - headW + 2} ${cy - 20} Z`} fill={hair} stroke={INK} strokeWidth={sw} strokeLinejoin="round" />}
      {L.hair === 1 && <path d={`M${cx - headW + 2} ${cy - 10} Q${cx - headW - 4} ${cy - headH - 20} ${cx + 10} ${cy - headH - 6} Q${cx + headW + 6} ${cy - headH + 10} ${cx + headW - 2} ${cy - 16} Q${cx + 40} ${cy - 56} ${cx - 10} ${cy - 76} Q${cx - 50} ${cy - 50} ${cx - headW + 2} ${cy - 10} Z`} fill={hair} stroke={INK} strokeWidth={sw} strokeLinejoin="round" />}
      {(L.hair === 2 || L.hair === 3) && <path d={`M${cx - headW} ${cy - 4} Q${cx - headW + 4} ${cy - headH - 16} ${cx} ${cy - headH - 6} Q${cx + headW - 4} ${cy - headH - 16} ${cx + headW} ${cy - 4} Q${cx + 20} ${cy - 80} ${cx - headW} ${cy - 4} Z`} fill={hair} stroke={INK} strokeWidth={sw} strokeLinejoin="round" />}
      {L.hair === 4 && Array.from({ length: 11 }, (_, i) => {
        const a = Math.PI + (i / 10) * Math.PI;
        return <circle key={i} cx={cx + Math.cos(a) * (headW - 6)} cy={cy - 30 + Math.sin(a) * (headH - 10)} r="22" fill={hair} stroke={INK} strokeWidth={sw} />;
      })}
      {L.hair === 5 && <path d={`M${cx - headW + 8} ${cy - 40} Q${cx} ${cy - headH - 14} ${cx + headW - 8} ${cy - 40}`} fill="none" stroke={hair} strokeWidth="14" strokeDasharray="2 6" opacity="0.8" />}
      {L.hair === 6 && <path d={`M${cx - headW + 4} ${cy - 30} Q${cx} ${cy - headH - 14} ${cx + headW - 4} ${cy - 30} Q${cx} ${cy - headH + 20} ${cx - headW + 4} ${cy - 30} Z`} fill={hair} stroke={INK} strokeWidth={sw} />}

      {/* hats */}
      {L.hat === 1 && <path d={`M${cx - headW - 4} ${cy - 40} Q${cx} ${cy - headH - 60} ${cx + headW + 4} ${cy - 40} Z`} fill="#3b4a5a" stroke={INK} strokeWidth={sw} />}
      {L.hat === 1 && <rect x={cx - headW - 6} y={cy - 50} width={headW * 2 + 12} height="20" rx="6" fill="#2f3b48" stroke={INK} strokeWidth={sw} />}
      {L.hat === 2 && <path d={`M${cx - headW} ${cy - 44} Q${cx} ${cy - headH - 40} ${cx + headW} ${cy - 44} Z M${cx - 20} ${cy - 46} L${cx + headW + 50} ${cy - 40} L${cx + headW} ${cy - 54}`} fill="#6b2f2f" stroke={INK} strokeWidth={sw} strokeLinejoin="round" />}
      {L.hat === 3 && <path d={`M${cx - headW - 20} ${cy + 120} Q${cx - headW - 30} ${cy - headH - 30} ${cx} ${cy - headH - 30} Q${cx + headW + 30} ${cy - headH - 30} ${cx + headW + 20} ${cy + 120} L${cx + headW - 6} ${cy + 60} Q${cx + headW} ${cy - headH + 10} ${cx} ${cy - headH + 6} Q${cx - headW} ${cy - headH + 10} ${cx - headW + 6} ${cy + 60} Z`} fill="#4b4f45" stroke={INK} strokeWidth={sw} strokeLinejoin="round" />}

      {/* brows */}
      {[-1, 1].map((d) => (
        <path key={d}
          d={L.brows === 0 ? `M${cx + d * 18} ${cy - 30} Q${cx + d * 36} ${cy - 40} ${cx + d * 54} ${cy - 30}` : L.brows === 1 ? `M${cx + d * 18} ${cy - 34} L${cx + d * 54} ${cy - 30}` : `M${cx + d * 18} ${cy - 28} Q${cx + d * 36} ${cy - 44} ${cx + d * 56} ${cy - 36}`}
          fill="none" stroke={hair === HAIR[4] ? '#555' : INK} strokeWidth={mini ? 7 : 6} strokeLinecap="round" />
      ))}

      {/* eyes */}
      {!ap.sunglasses && [-1, 1].map((d) => {
        const ex = cx + d * 36, ey = cy - 6;
        const cloudy = ap.eyes === 'clouded';
        const red = ap.eyes === 'red';
        return (
          <g key={d}>
            <ellipse cx={ex} cy={ey} rx="17" ry="12" fill={red ? '#f5d6d0' : '#fbfbf7'} stroke={INK} strokeWidth={sw - 1} />
            {red && <path d={`M${ex - 15} ${ey + 2} l7 -2 M${ex + 15} ${ey - 1} l-7 3 M${ex - 12} ${ey - 6} l6 3`} stroke="#c0392b" strokeWidth="1.4" />}
            <circle cx={ex} cy={ey} r="8" fill={cloudy ? '#d9dcd6' : IRIS[L.eyeColor]} stroke={cloudy ? '#b9bdb5' : INK} strokeWidth="1.5" />
            {!cloudy && <circle cx={ex} cy={ey} r="3.6" fill={INK} />}
            {cloudy && <circle cx={ex - 1} cy={ey - 1} r="5" fill="#eceee9" opacity="0.8" />}
            <circle cx={ex + 3} cy={ey - 4} r="2" fill="#fff" opacity={cloudy ? 0.3 : 0.9} />
            <path d={`M${ex - 18} ${ey - 2} Q${ex} ${ey - 15} ${ex + 18} ${ey - 2}`} fill="none" stroke={INK} strokeWidth={sw - 1} />
          </g>
        );
      })}
      {L.glasses && !ap.sunglasses && (
        <g fill="none" stroke={INK} strokeWidth="4">
          <rect x={cx - 60} y={cy - 22} width="46" height="32" rx="8" />
          <rect x={cx + 14} y={cy - 22} width="46" height="32" rx="8" />
          <path d={`M${cx - 14} ${cy - 8} Q${cx} ${cy - 14} ${cx + 14} ${cy - 8}`} />
        </g>
      )}
      {ap.sunglasses && (
        <g>
          <path d={`M${cx - 64} ${cy - 22} L${cx - 10} ${cy - 22} Q${cx - 12} ${cy + 16} ${cx - 38} ${cy + 14} Q${cx - 64} ${cy + 12} ${cx - 64} ${cy - 22} Z`} fill="#111" stroke={INK} strokeWidth="4" />
          <path d={`M${cx + 64} ${cy - 22} L${cx + 10} ${cy - 22} Q${cx + 12} ${cy + 16} ${cx + 38} ${cy + 14} Q${cx + 64} ${cy + 12} ${cx + 64} ${cy - 22} Z`} fill="#111" stroke={INK} strokeWidth="4" />
          <path d={`M${cx - 10} ${cy - 18} L${cx + 10} ${cy - 18}`} stroke={INK} strokeWidth="5" />
          <path d={`M${cx - 54} ${cy - 16} l14 0`} stroke="#555" strokeWidth="3" strokeLinecap="round" />
          <path d={`M${cx + 22} ${cy - 16} l14 0`} stroke="#555" strokeWidth="3" strokeLinecap="round" />
        </g>
      )}

      {/* nose */}
      {L.nose === 0 && <path d={`M${cx - 4} ${cy + 4} Q${cx - 14} ${cy + 34} ${cx - 2} ${cy + 38} Q${cx + 10} ${cy + 40} ${cx + 12} ${cy + 32}`} fill="none" stroke={INK} strokeWidth={sw - 0.5} strokeLinecap="round" />}
      {L.nose === 1 && <path d={`M${cx} ${cy} L${cx - 12} ${cy + 36} L${cx + 10} ${cy + 36}`} fill="none" stroke={INK} strokeWidth={sw - 0.5} strokeLinejoin="round" strokeLinecap="round" />}
      {L.nose === 2 && <><ellipse cx={cx} cy={cy + 30} rx="14" ry="11" fill={shade} stroke={INK} strokeWidth={sw - 1} /><circle cx={cx - 5} cy={cy + 32} r="2" fill={INK} /><circle cx={cx + 5} cy={cy + 32} r="2" fill={INK} /></>}

      {/* beard */}
      {L.beard === 1 && Array.from({ length: 26 }, (_, i) => <circle key={i} cx={cx - 50 + (i % 13) * 8.3} cy={cy + 62 + Math.floor(i / 13) * 12 + ((i * 7) % 5)} r="1.6" fill={hair} />)}
      {L.beard === 2 && <path d={`M${cx - headW + 12} ${cy + 20} Q${cx - 50} ${cy + headH + 30} ${cx} ${cy + headH + 22} Q${cx + 50} ${cy + headH + 30} ${cx + headW - 12} ${cy + 20} Q${cx + 40} ${cy + 74} ${cx} ${cy + 70} Q${cx - 40} ${cy + 74} ${cx - headW + 12} ${cy + 20} Z`} fill={hair} stroke={INK} strokeWidth={sw} />}
      {L.beard === 3 && <path d={`M${cx - 30} ${cy + 52} Q${cx} ${cy + 40} ${cx + 30} ${cy + 52} Q${cx} ${cy + 60} ${cx - 30} ${cy + 52} Z`} fill={hair} stroke={INK} strokeWidth="3" />}

      {/* mouth */}
      {ap.mouth === null ? (
        <path d={`M${cx - 26} ${cy + 62} Q${cx} ${cy + 74} ${cx + 26} ${cy + 62}`} fill="none" stroke={INK} strokeWidth={sw} strokeLinecap="round" />
      ) : (
        <g>
          <ellipse cx={cx} cy={cy + 68} rx="34" ry="24" fill="#2a0f0f" stroke={INK} strokeWidth={sw} />
          <path d={`M${cx - 30} ${cy + 58} Q${cx} ${cy + 46} ${cx + 30} ${cy + 58} L${cx + 30} ${cy + 64} Q${cx} ${cy + 54} ${cx - 30} ${cy + 64} Z`} fill={ap.mouth === 'black' ? '#1d1a17' : '#d9737a'} />
          <path d={`M${cx - 30} ${cy + 78} Q${cx} ${cy + 92} ${cx + 30} ${cy + 78} L${cx + 30} ${cy + 74} Q${cx} ${cy + 86} ${cx - 30} ${cy + 74} Z`} fill={ap.mouth === 'black' ? '#1d1a17' : '#d9737a'} />
          {Array.from({ length: 6 }, (_, i) => (
            <rect key={i} x={cx - 24 + i * 8} y={cy + 59 - (i === 0 || i === 5 ? -2 : 0)} width="7" height="9" rx="1.5" fill={ap.mouth === 'yellow' ? '#e2cf7a' : ap.mouth === 'black' ? '#b8b29a' : '#f7f5ee'} stroke={INK} strokeWidth="1" />
          ))}
          {Array.from({ length: 6 }, (_, i) => (
            <rect key={`l${i}`} x={cx - 24 + i * 8} y={cy + 70} width="7" height="8" rx="1.5" fill={ap.mouth === 'yellow' ? '#e2cf7a' : ap.mouth === 'black' ? '#b8b29a' : '#f7f5ee'} stroke={INK} strokeWidth="1" />
          ))}
        </g>
      )}

      {/* neck details drawn last so the chin never hides them */}
      {ap.neck === 'bite' && (
        <g transform="translate(176 268) scale(1.7)">
          <ellipse cx="12" cy="12" rx="13" ry="10" fill="#6b1d1d" opacity="0.35" />
          {[0, 1, 2, 3, 4].map((i) => <path key={i} d={`M${2 + i * 5} ${6 - Math.abs(2 - i)} l1 4`} stroke="#4a0909" strokeWidth="2.6" strokeLinecap="round" />)}
          {[0, 1, 2, 3, 4].map((i) => <path key={`b${i}`} d={`M${2 + i * 5} ${18 + Math.abs(2 - i)} l1 -4`} stroke="#4a0909" strokeWidth="2.6" strokeLinecap="round" />)}
        </g>
      )}
      {ap.neck === 'bandage' && (
        <g transform="rotate(-8 205 282)">
          <rect x="180" y="264" width="50" height="34" rx="4" fill="#efe9dc" stroke={INK} strokeWidth="3.5" />
          <path d="M186 272 h38 M186 282 h38 M186 291 h38" stroke="#c8bfae" strokeWidth="2" />
          <circle cx="205" cy="282" r="6" fill="#b34a4a" opacity="0.45" />
        </g>
      )}
      {ap.neck === 'stitches' && (
        <g stroke="#8b2c2c" strokeWidth="3" strokeLinecap="round">
          <path d="M180 288 L224 274" />
          {[0, 1, 2, 3, 4, 5].map((i) => <path key={i} d={`M${184 + i * 7} ${282 - i * 2.3} l2 10`} />)}
        </g>
      )}

      {/* grey skin: blotches */}
      {ap.skin === 'grey' && (
        <g opacity="0.35">
          <circle cx={cx - 50} cy={cy + 30} r="10" fill="#5d6b52" />
          <circle cx={cx + 56} cy={cy - 50} r="7" fill="#5d6b52" />
          <circle cx={cx + 40} cy={cy + 70} r="6" fill="#5d6b52" />
        </g>
      )}

      {/* hands on the glass */}
      {showHands && ap.hands && [-1, 1].map((d) => {
        const hx = 200 + d * 130, hy = 330;
        const nail = ap.hands === 'grey' ? '#6f7568' : ap.hands === 'dirty' ? '#6b4a2b' : '#f0c4b4';
        return (
          <g key={d} transform={`translate(${hx} ${hy}) scale(${d} 1)`}>
            <path d="M-30 70 L-30 0 Q-30 -10 -22 -10 L-22 -46 Q-22 -56 -14 -56 Q-6 -56 -6 -46 L-6 -60 Q-6 -70 2 -70 Q10 -70 10 -60 L10 -54 Q10 -62 18 -62 Q26 -62 26 -52 L26 -40 Q26 -48 33 -48 Q40 -48 40 -38 L40 20 Q40 50 20 70 Z"
              fill={ap.skin === 'grey' ? GREY : skin} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
            {[[-14, -50], [2, -64], [18, -56], [33, -42]].map(([x, y], i) => (
              <g key={i}>
                <rect x={x - 5} y={y} width="10" height="9" rx="3" fill={nail} stroke={INK} strokeWidth="1.5" />
                {ap.hands === 'grey' && <path d={`M${x - 2} ${y + 1} l3 6`} stroke="#3b3f36" strokeWidth="1.2" />}
              </g>
            ))}
            <path d="M-30 0 Q-44 -10 -46 -30 Q-46 -40 -38 -38 Q-30 -30 -28 -14" fill={ap.skin === 'grey' ? GREY : skin} stroke={INK} strokeWidth="4" />
          </g>
        );
      })}
    </svg>
  );
}
