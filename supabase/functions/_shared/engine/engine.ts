// THE LAST CHECKPOINT v2 — authoritative engine (server-side only).
// One night shift: 6 visitors arrive one at a time. One of them is the zombie player in disguise.

import {
  ANOMALIES, BITTEN, COMPLY_LINES, CONFIG, COVERS, DEFLECTS, FIRST, GREETINGS, INTENTS, JOBS, LAST, LOOK, MONTHS,
  ORIGINS, QUESTION_COST, QUESTION_ORDER, QUESTIONS, REASONS, REFUSE_LINES, RELATIONS, REQUEST_COST, REQUESTS, SABOTAGE,
  SMALLTALK, TOOL_ORDER, TOOLS, WIN_HEADLINES, WORLD_YEAR,
} from './data.ts';
import type {
  Anomaly, AnyAction, Appearance, Cover, DbRecord, Demeanor, Exchange, ExchangeView, FactKey, GuardView, Herring, IdCard,
  IdentityOption, LogEntry, Look, MatchState, PlayerView, QuestionId, RequestId, ResultView, Role, Sabotage, ToolId,
  ToolInfo, ToolResult, Visitor, VisitorView, WinReason, ZombieView,
} from './types.ts';

// ------------------------------------------------------------------ RNG

export function rand(s: MatchState): number {
  let t = (s.rng = (s.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const randInt = (s: MatchState, a: number, b: number) => a + Math.floor(rand(s) * (b - a + 1));
const randFloat = (s: MatchState, a: number, b: number) => a + rand(s) * (b - a);
const chance = (s: MatchState, p: number) => rand(s) < p;
function pick<T>(s: MatchState, arr: readonly T[]): T {
  return arr[Math.floor(rand(s) * arr.length)];
}
function shuffle<T>(s: MatchState, arr: readonly T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand(s) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class ActionError extends Error {}
function fail(msg: string): never {
  throw new ActionError(msg);
}

function log(s: MatchState, now: number, text: string, kind: LogEntry['kind'] = 'info', to: LogEntry['to'] = 'all') {
  s.log.push({ t: now, text, kind, to });
  if (s.log.length > 100) s.log.splice(0, s.log.length - 100);
}

function finish(s: MatchState, winner: Role, reason: WinReason, now: number) {
  if (s.phase === 'finished') return;
  s.phase = 'finished';
  s.winner = winner;
  s.winReason = reason;
  s.endedAt = now;
  log(s, now, WIN_HEADLINES[reason], winner === 'guard' ? 'good' : 'danger');
}

// ------------------------------------------------------------------ people

function genLook(s: MatchState): Look {
  return {
    skin: randInt(s, 0, LOOK.skin - 1),
    hair: randInt(s, 0, LOOK.hair - 1),
    hairColor: randInt(s, 0, LOOK.hairColor - 1),
    eyeColor: randInt(s, 0, LOOK.eyeColor - 1),
    face: randInt(s, 0, LOOK.face - 1),
    nose: randInt(s, 0, LOOK.nose - 1),
    brows: randInt(s, 0, LOOK.brows - 1),
    beard: chance(s, 0.35) ? randInt(s, 1, LOOK.beard - 1) : 0,
    shirt: randInt(s, 0, LOOK.shirt - 1),
    hat: chance(s, 0.25) ? randInt(s, 1, LOOK.hat - 1) : 0,
    glasses: chance(s, 0.18),
  };
}

/** A clearly-but-not-obviously different face, for mismatched ID photos. */
function mutateLook(s: MatchState, look: Look, n = 2): Look {
  const out = { ...look };
  const muts = shuffle(s, ['hairColor', 'beard', 'glasses', 'hair', 'face', 'brows'] as const).slice(0, n);
  for (const m of muts) {
    if (m === 'hairColor') out.hairColor = (look.hairColor + randInt(s, 1, LOOK.hairColor - 1)) % LOOK.hairColor;
    if (m === 'beard') out.beard = look.beard ? 0 : randInt(s, 1, LOOK.beard - 1);
    if (m === 'glasses') out.glasses = !look.glasses;
    if (m === 'hair') out.hair = (look.hair + randInt(s, 1, LOOK.hair - 1)) % LOOK.hair;
    if (m === 'face') out.face = (look.face + 1) % LOOK.face;
    if (m === 'brows') out.brows = (look.brows + 1) % LOOK.brows;
  }
  return out;
}

function usedNames(s: MatchState): Set<string> {
  const set = new Set<string>(s.visitors.map((v) => v.name));
  for (const o of s.zombie.identityOptions) set.add(o.visitor.name);
  return set;
}

interface Person {
  name: string; age: number; dob: string; origin: string; job: string; contact: string; contactName: string;
  relation: string; reason: string; idNumber: string; demeanor: Demeanor;
}

function genPerson(s: MatchState): Person {
  const taken = usedNames(s);
  let name = '';
  for (let i = 0; i < 60; i++) {
    name = `${pick(s, FIRST)} ${pick(s, LAST)}`;
    if (!taken.has(name)) break;
  }
  const age = randInt(s, 19, 64);
  const dob = `${String(randInt(s, 1, 28)).padStart(2, '0')} ${pick(s, MONTHS)} ${WORLD_YEAR - age}`;
  const relation = pick(s, RELATIONS);
  const contactName = `${pick(s, FIRST)} ${relation === 'friend' || relation === 'neighbour' ? pick(s, LAST) : name.split(' ')[1]}`;
  return {
    name, age, dob,
    origin: pick(s, ORIGINS),
    job: pick(s, JOBS),
    contactName, relation,
    contact: `${contactName} (${relation})`,
    reason: pick(s, REASONS),
    idNumber: `${String.fromCharCode(65 + randInt(s, 0, 25))}${String.fromCharCode(65 + randInt(s, 0, 25))}-${randInt(s, 100000, 999999)}`,
    demeanor: pick(s, ['calm', 'nervous', 'chatty', 'grumpy', 'quiet'] as const),
  };
}

function baseVisitor(s: MatchState, p: Person, look: Look, photo: Look, expired: boolean, record: DbRecord): Visitor {
  return {
    id: `v${s.nextId++}`,
    index: -1,
    isZombie: false,
    name: p.name,
    age: p.age,
    look,
    card: {
      name: p.name, dob: p.dob, idNumber: p.idNumber, origin: p.origin,
      expires: `${pick(s, MONTHS)} ${expired ? WORLD_YEAR - 1 : WORLD_YEAR + randInt(s, 1, 4)}`,
      expired,
      photo,
    },
    record,
    truth: { origin: p.origin, dob: p.dob, job: p.job, contact: p.contact, reason: p.reason },
    greeting: pick(s, GREETINGS),
    demeanor: p.demeanor,
    anomalies: [],
    covers: [],
    herrings: [],
    phoneReply: '',
    memory: {},
    removed: {},
    shown: {},
    tools: {},
    exchanges: [],
    decision: null,
  };
}

const HERRING_POOL: { h: Herring; w: number }[] = [
  { h: 'sunglasses', w: 8 }, { h: 'pale', w: 9 }, { h: 'tired', w: 10 }, { h: 'fever', w: 8 }, { h: 'chilled', w: 9 },
  { h: 'bandage', w: 9 }, { h: 'yellowTeeth', w: 9 }, { h: 'dirtyNails', w: 9 }, { h: 'expired', w: 6 },
  { h: 'unregistered', w: 6 }, { h: 'noAnswer', w: 6 }, { h: 'shy', w: 7 },
];

function pickHerrings(s: MatchState): Herring[] {
  const n = chance(s, 0.55) ? 2 : chance(s, 0.75) ? 1 : 3;
  const out: Herring[] = [];
  while (out.length < n) {
    const total = HERRING_POOL.reduce((a, b) => a + b.w, 0);
    let r = rand(s) * total;
    for (const x of HERRING_POOL) {
      if ((r -= x.w) < 0) {
        if (!out.includes(x.h) && !(x.h === 'fever' && out.includes('chilled')) && !(x.h === 'chilled' && out.includes('fever'))) out.push(x.h);
        break;
      }
    }
  }
  return out;
}

function genNpc(s: MatchState): Visitor {
  const p = genPerson(s);
  const look = genLook(s);
  const herrings = pickHerrings(s);
  const expired = herrings.includes('expired');
  const unregistered = herrings.includes('unregistered');
  // Old / expired cards sometimes carry an outdated photo: an innocent mismatch.
  const photo = expired && chance(s, 0.7) ? mutateLook(s, look, 1) : chance(s, 0.08) ? mutateLook(s, look, 1) : { ...look };
  const missingButBack = !unregistered && chance(s, 0.1);
  const record: DbRecord = unregistered
    ? { status: 'none', name: '', job: '', contact: '', note: '' }
    : {
      status: missingButBack ? 'missing' : 'active', name: p.name, job: p.job, contact: p.contact,
      note: missingButBack ? `Reported missing ${randInt(s, 5, 30)} days ago.` : 'Registered resident.',
    };
  const v = baseVisitor(s, p, look, photo, expired, record);
  v.herrings = herrings;
  if (herrings.includes('sunglasses')) v.covers.push('sunglasses');
  if (herrings.includes('bandage')) v.covers.push('bandage');
  v.phoneReply = unregistered
    ? 'No contact number on file.'
    : herrings.includes('noAnswer')
    ? 'The line rings and rings. Nobody picks up.'
    : missingButBack
    ? `"${p.name.split(' ')[0]}?! Oh my god — we thought they were dead! Is it really them?"`
    : pick(s, [
      `"Yes, that's my ${p.relation}. They left ${pick(s, ORIGINS)}... I mean, they were heading your way. Please let them in."`,
      `"${p.name.split(' ')[0]}? Yes! They called me two days ago. They're alive?"`,
      `"That's my ${p.relation}. Tell them I'm waiting."`,
    ]);
  return v;
}

function genZombieOption(s: MatchState, key: 'A' | 'B' | 'C'): IdentityOption {
  const p = genPerson(s);
  const look = genLook(s);
  let photo = { ...look };
  let record: DbRecord;
  let phone: string;
  let label: string, risk: string;
  if (key === 'A') {
    photo = mutateLook(s, look, 2);
    record = { status: 'active', name: p.name, job: p.job, contact: p.contact, note: 'Registered resident.' };
    phone = `"${p.name.split(' ')[0]}? I haven't heard from them since Tuesday. Are they okay? They sounded... strange."`;
    label = 'Active resident';
    risk = 'The database looks clean, but the ID photo doesn\'t quite match your face.';
  } else if (key === 'B') {
    record = { status: 'missing', name: p.name, job: p.job, contact: p.contact, note: `Reported missing ${randInt(s, 9, 20)} days ago.` };
    phone = `"${p.name.split(' ')[0]} has been missing for two weeks. If that's really them... why didn't they call me?"`;
    label = 'Missing person';
    risk = 'Perfect photo match, but the database flags this person as MISSING.';
  } else {
    record = { status: 'none', name: '', job: '', contact: '', note: '' };
    phone = 'No contact number on file.';
    label = 'Unregistered refugee';
    risk = 'Nothing to check against, so no contradictions, but no records means less trust.';
  }
  const v = baseVisitor(s, p, look, photo, false, record);
  v.isZombie = true;
  v.phoneReply = phone;
  // The infection eats memory: the zombie always knows what's printed on the card, but only part of the rest.
  v.memory = { origin: true, dob: true, job: chance(s, 0.5), contact: chance(s, 0.5) };
  return { key, label, risk, visitor: v };
}

// ------------------------------------------------------------------ setup

export function createMatch(seed: number, now: number): MatchState {
  const s: MatchState = {
    schema: 2,
    phase: 'visit',
    rng: seed | 0,
    nextId: 1,
    total: CONFIG.visitors,
    current: -1,
    visitors: [],
    actions: 0,
    actionsMax: CONFIG.actionsPerVisitor,
    trust: CONFIG.startTrust,
    zombie: {
      prepared: false, queued: false, arrived: false, identityOptions: [], chosen: null, covers: [], anomalies: [],
      sabotage: { phone: SABOTAGE.phone.uses, database: SABOTAGE.database.uses, distraction: SABOTAGE.distraction.uses },
      pendingSabotage: [],
    },
    active: { phoneDead: false, dbDown: false, distracted: false },
    log: [],
    processed: [],
    counters: { questions: 0, freeQuestions: 0, requests: 0, tools: 0, innocentsApproved: 0, innocentsDenied: 0, sabotageUsed: 0 },
    winner: null,
    winReason: null,
    startedAt: now,
    endedAt: null,
  };
  s.zombie.anomalies = shuffle(s, ANOMALIES).slice(0, CONFIG.zombieAnomalies);
  s.zombie.identityOptions = (['A', 'B', 'C'] as const).map((k) => genZombieOption(s, k));
  log(s, now, 'Night shift begins. Six visitors are expected. One of them is not human.', 'info', 'guard');
  log(s, now, 'Build your disguise, then choose when to step into line. You must arrive by visitor #6.', 'info', 'zombie');
  arriveNext(s, now);
  return s;
}

function defaultCovers(anoms: Anomaly[]): Cover[] {
  const prefs: Cover[] = [];
  for (const [c, meta] of Object.entries(COVERS) as [Cover, { hides: Anomaly }][]) if (anoms.includes(meta.hides)) prefs.push(c);
  return prefs.slice(0, CONFIG.zombieCovers);
}

function arriveNext(s: MatchState, now: number) {
  const index = s.visitors.length;
  const z = s.zombie;
  const lastSlot = index === s.total - 1;
  const zombieNow = !z.arrived && index >= CONFIG.firstZombieSlot && (z.queued || lastSlot);
  let v: Visitor;
  if (zombieNow) {
    if (!z.prepared) {
      z.chosen = 'A';
      z.covers = defaultCovers(z.anomalies);
      z.prepared = true;
      log(s, now, 'Out of time — you step into line with whatever disguise you had.', 'warn', 'zombie');
    }
    const opt = z.identityOptions.find((o) => o.key === z.chosen)!;
    v = structuredClone(opt.visitor);
    v.anomalies = [...z.anomalies];
    v.covers = [...z.covers];
    z.arrived = true;
    z.queued = false;
  } else {
    v = genNpc(s);
  }
  v.index = index;
  const prevGreeting = s.visitors.at(-1)?.greeting;
  if (prevGreeting && v.greeting === prevGreeting) v.greeting = pick(s, GREETINGS.filter((g) => g !== prevGreeting));

  s.active = { phoneDead: false, dbDown: false, distracted: false };
  for (const sab of z.pendingSabotage) {
    if (sab === 'phone') s.active.phoneDead = true;
    if (sab === 'database') s.active.dbDown = true;
    if (sab === 'distraction') s.active.distracted = true;
  }
  z.pendingSabotage = [];

  s.visitors.push(v);
  s.current = index;
  s.phase = 'visit';
  s.actions = s.actionsMax - (s.active.distracted ? 2 : 0);
  v.exchanges.push({
    id: s.nextId++, kind: 'greeting', guardLine: '', options: [], answer: v.greeting, askedAt: now, deadline: now,
    answeredAt: now, revealAt: now, revealed: true,
  });

  log(s, now, `Visitor #${index + 1} approaches the window.`, 'info', 'guard');
  log(s, now, zombieNow ? `You are visitor #${index + 1}. You're at the window. Stay calm.` : `Visitor #${index + 1} (human) is at the window.`, zombieNow ? 'danger' : 'info', 'zombie');
  if (s.active.phoneDead) log(s, now, 'The phone line is dead.', 'event');
  if (s.active.dbDown) log(s, now, 'DATABASE OFFLINE — connection lost.', 'event');
  if (s.active.distracted) log(s, now, 'ALARM at the east fence! You lose 2 actions dealing with it.', 'event');
}

// ------------------------------------------------------------------ appearance

export function appearance(v: Visitor, reveal = false): Appearance {
  const wearsSun = v.covers.includes('sunglasses') && !v.removed.sunglasses && !reveal;
  const wearsBandage = v.covers.includes('bandage') && !v.removed.bandage && !reveal;
  const has = (a: Anomaly) => v.isZombie && v.anomalies.includes(a);
  let eyes: Appearance['eyes'] = 'normal';
  if (wearsSun) eyes = 'hidden';
  else if (has('eyes')) eyes = 'clouded';
  else if (v.herrings.includes('tired')) eyes = 'red';
  let skin: Appearance['skin'] = 'normal';
  if (has('skin') && (!v.covers.includes('makeup') || reveal)) skin = 'grey';
  else if (v.herrings.includes('pale')) skin = 'pale';
  let neck: Appearance['neck'] = 'clear';
  if (wearsBandage) neck = 'bandage';
  else if (has('bite')) neck = 'bite';
  else if (v.herrings.includes('bandage')) neck = 'stitches';
  const mouth: Appearance['mouth'] = !v.shown.mouth && !reveal ? null : has('gums') ? 'black' : v.herrings.includes('yellowTeeth') ? 'yellow' : 'normal';
  const hands: Appearance['hands'] = !v.shown.hands && !reveal ? null : has('nails') ? 'grey' : v.herrings.includes('dirtyNails') ? 'dirty' : 'normal';
  return { look: { ...v.look }, eyes, skin, sunglasses: wearsSun, neck, mouth, hands };
}

function canRequest(v: Visitor): Record<RequestId, boolean> {
  return {
    sunglasses: v.covers.includes('sunglasses') && !v.removed.sunglasses,
    mouth: !v.shown.mouth,
    hands: !v.shown.hands,
    bandage: v.covers.includes('bandage') && !v.removed.bandage,
  };
}

// ------------------------------------------------------------------ dialogue

const SLIP: Record<Demeanor, { slip: number; deflect: number }> = {
  calm: { slip: 0.04, deflect: 0.04 },
  nervous: { slip: 0.16, deflect: 0.12 },
  chatty: { slip: 0.08, deflect: 0.06 },
  grumpy: { slip: 0.05, deflect: 0.2 },
  quiet: { slip: 0.05, deflect: 0.22 },
};

function phrase(q: Exclude<QuestionId, 'free'>, v: Visitor, value: string): string {
  switch (q) {
    case 'name': return `It's ${value}.`;
    case 'origin': return `From ${value}.`;
    case 'dob': return `${value}.`;
    case 'job': return `I was a ${value}.`;
    case 'contact': return `${value}.`;
    case 'reason': return value;
    case 'bitten': return value;
  }
}

function wrongValue(s: MatchState, q: 'origin' | 'dob' | 'job' | 'contact', v: Visitor, exclude: string[] = []): string {
  for (let i = 0; i < 30; i++) {
    let c = '';
    if (q === 'origin') c = pick(s, ORIGINS);
    if (q === 'job') c = pick(s, JOBS);
    if (q === 'dob') {
      const [d, m, y] = v.truth.dob.split(' ');
      c = chance(s, 0.5) ? `${d} ${pick(s, MONTHS)} ${y}` : `${d} ${m} ${Number(y) + (chance(s, 0.5) ? 1 : -1) * randInt(s, 1, 3)}`;
    }
    if (q === 'contact') c = `${pick(s, FIRST)} ${v.name.split(' ')[1]} (${pick(s, RELATIONS)})`;
    if (c && c !== v.truth[q] && !exclude.includes(c)) return c;
  }
  return '???';
}

function npcAnswer(s: MatchState, v: Visitor, q: Exclude<QuestionId, 'free'> | 'smalltalk'): string {
  if (q === 'smalltalk') return pick(s, SMALLTALK[v.demeanor]);
  if (q === 'name') return phrase('name', v, v.name);
  if (q === 'reason') return v.truth.reason;
  if (q === 'bitten') {
    if (v.herrings.includes('bandage')) return chance(s, 0.75) ? BITTEN.scratch : BITTEN.no;
    return chance(s, 0.92) ? BITTEN.no : BITTEN.old;
  }
  const p = SLIP[v.demeanor];
  if (chance(s, p.deflect)) return pick(s, DEFLECTS[v.demeanor]);
  if (chance(s, p.slip)) return phrase(q, v, wrongValue(s, q, v));
  return phrase(q, v, v.truth[q]);
}

function zombieOptions(s: MatchState, v: Visitor, q: Exclude<QuestionId, 'free'> | 'smalltalk'): string[] {
  const deflect = pick(s, DEFLECTS[v.demeanor]);
  if (q === 'smalltalk') {
    const pool = shuffle(s, [...SMALLTALK.calm, ...SMALLTALK.nervous, ...SMALLTALK.chatty, ...SMALLTALK.grumpy]).slice(0, 3);
    return [...pool, '...'];
  }
  if (q === 'name') return [phrase('name', v, v.name), deflect];
  if (q === 'reason') return [...shuffle(s, [v.truth.reason, ...shuffle(s, REASONS.filter((r) => r !== v.truth.reason)).slice(0, 2)]), deflect];
  if (q === 'bitten') return [BITTEN.no, BITTEN.scratch, BITTEN.old, deflect];
  const w1 = wrongValue(s, q, v);
  const w2 = wrongValue(s, q, v, [w1]);
  return [...shuffle(s, [v.truth[q], w1, w2]).map((x) => phrase(q, v, x)), deflect];
}

function classify(text: string): Exclude<QuestionId, 'free'> | 'smalltalk' {
  for (const i of INTENTS) if (i.words.test(text)) return i.id;
  return 'smalltalk';
}

function npcDelay(s: MatchState, v: Visitor): number {
  const [a, b] = CONFIG.npcDelayMs;
  const slow = v.demeanor === 'nervous' || v.demeanor === 'quiet' ? 1.6 : 1;
  return Math.round(a + Math.pow(rand(s), 1.4) * (b - a) * slow);
}

function pendingExchange(v: Visitor | undefined): Exchange | null {
  return v?.exchanges.find((e) => !e.revealed) ?? null;
}

function currentVisitor(s: MatchState): Visitor {
  const v = s.visitors[s.current];
  if (!v) fail('Nobody is at the window.');
  return v;
}

/** Reveal answers whose time has come; auto-answer for a zombie who ran out of time. */
function processTime(s: MatchState, now: number) {
  const v = s.visitors[s.current];
  if (!v) return;
  for (const e of v.exchanges) {
    if (e.revealed) continue;
    if (e.answer === null && now >= e.deadline) {
      // Zombie hesitated too long: auto-deflect / refuse.
      e.answer = e.kind === 'request' ? e.options[1] : e.options[e.options.length - 1];
      if (e.kind === 'request') e.complied = false;
      e.answeredAt = now;
      e.revealAt = now;
      log(s, now, 'You hesitated too long. Your disguise mumbled something.', 'warn', 'zombie');
    }
    if (e.answer !== null && e.revealAt !== null && now >= e.revealAt) {
      e.revealed = true;
      if (e.kind === 'request' && e.complied && e.requestId) {
        if (e.requestId === 'sunglasses') v.removed.sunglasses = true;
        if (e.requestId === 'bandage') v.removed.bandage = true;
        if (e.requestId === 'mouth') v.shown.mouth = true;
        if (e.requestId === 'hands') v.shown.hands = true;
      }
    }
  }
}

function newExchange(s: MatchState, now: number, v: Visitor, base: Pick<Exchange, 'kind' | 'guardLine' | 'questionId' | 'requestId'>, npc: () => { answer: string; complied?: boolean }, zOptions: () => string[]) {
  const e: Exchange = {
    id: s.nextId++, ...base, options: [], answer: null, askedAt: now, deadline: now + CONFIG.answerTimeoutMs,
    answeredAt: null, revealAt: null, revealed: false,
  };
  if (v.isZombie) {
    e.options = zOptions();
    log(s, now, `The guard: "${base.guardLine}"`, 'warn', 'zombie');
  } else {
    const r = npc();
    e.answer = r.answer;
    e.complied = r.complied;
    e.answeredAt = now;
    e.revealAt = now + npcDelay(s, v);
  }
  v.exchanges.push(e);
}

// ------------------------------------------------------------------ tools

function toolBlock(s: MatchState, v: Visitor, tool: ToolId): string | null {
  if (v.tools[tool]) return 'Already done';
  if (tool === 'database' && s.active.dbDown) return 'Database offline';
  if (tool === 'phone' && s.active.phoneDead) return 'Line is dead';
  if (tool === 'flashlight' && v.covers.includes('sunglasses') && !v.removed.sunglasses) return 'Sunglasses in the way';
  if (s.actions < TOOLS[tool].cost) return 'No actions left';
  return null;
}

function runTool(s: MatchState, v: Visitor, tool: ToolId): ToolResult {
  const has = (a: Anomaly) => v.isZombie && v.anomalies.includes(a);
  switch (tool) {
    case 'database': {
      const r = v.record;
      if (r.status === 'none') return { tool, title: `ID ${v.card.idNumber}`, lines: ['NO RECORD FOUND.', 'This person is not registered in any shelter database.'], severity: 'odd' };
      return {
        tool,
        title: `ID ${v.card.idNumber}`,
        lines: [`Name: ${r.name}`, `Occupation: ${r.job}`, `Emergency contact: ${r.contact}`, `Status: ${r.status === 'missing' ? 'MISSING' : 'ACTIVE'}`, r.note],
        severity: r.status === 'missing' ? 'alarming' : 'normal',
      };
    }
    case 'phone': {
      const sev = /missing|strange|dead|No contact|Nobody/.test(v.phoneReply) ? 'odd' : 'normal';
      return { tool, title: v.record.status === 'none' ? 'Phone' : `Calling ${v.record.contact}`, lines: [v.phoneReply], severity: sev };
    }
    case 'thermometer': {
      let t: number;
      if (has('cold') && !v.covers.includes('heatpack')) t = randFloat(s, 33.1, 34.4);
      else if (v.isZombie) t = randFloat(s, 35.9, 36.7);
      else if (v.herrings.includes('fever')) t = randFloat(s, 38.2, 39.4);
      else if (v.herrings.includes('chilled')) t = randFloat(s, 34.8, 35.6);
      else t = randFloat(s, 36.2, 37.1);
      t = Math.round(t * 10) / 10;
      const severity = t < 34.6 ? 'alarming' : t < 36 || t > 37.8 ? 'odd' : 'normal';
      return { tool, title: 'Thermometer', lines: [`${t.toFixed(1)} °C`], severity };
    }
    case 'flashlight': {
      if (has('eyes')) return { tool, title: 'Flashlight', lines: ["The pupils don't react at all. The irises look milky."], severity: 'alarming' };
      if (v.isZombie) return chance(s, 0.4)
        ? { tool, title: 'Flashlight', lines: ['Pupils react... slowly.'], severity: 'odd' }
        : { tool, title: 'Flashlight', lines: ['Pupils contract normally.'], severity: 'normal' };
      if (v.herrings.includes('tired')) return { tool, title: 'Flashlight', lines: ['Bloodshot, but the pupils react normally.'], severity: 'odd' };
      if (v.herrings.includes('sunglasses')) return { tool, title: 'Flashlight', lines: ['They flinch hard from the light. Pupils react.'], severity: 'odd' };
      return { tool, title: 'Flashlight', lines: ['Pupils contract normally.'], severity: 'normal' };
    }
  }
}

// ------------------------------------------------------------------ actions

export interface ApplyResult {
  state: MatchState;
  duplicate: boolean;
}

export function applyAction(prev: MatchState, role: Role, action: AnyAction, now: number): ApplyResult {
  if (action.actionId && prev.processed.includes(action.actionId)) return { state: prev, duplicate: true };
  const s: MatchState = structuredClone(prev);
  processTime(s, now);
  if (s.phase === 'finished' && action.type !== 'tick') fail('The shift is over.');
  if (action.type !== 'tick') {
    if (role === 'guard') guardAction(s, action, now);
    else zombieAction(s, action, now);
    processTime(s, now);
  }
  if (action.actionId) {
    s.processed.push(action.actionId);
    if (s.processed.length > 100) s.processed.splice(0, s.processed.length - 100);
  }
  return { state: s, duplicate: false };
}

function guardAction(s: MatchState, a: AnyAction, now: number) {
  switch (a.type) {
    case 'ask':
    case 'ask_free': {
      if (s.phase !== 'visit') fail('Nobody is at the window.');
      const v = currentVisitor(s);
      if (pendingExchange(v)) fail('Wait for an answer.');
      if (s.actions < QUESTION_COST) fail('No actions left.');
      let q: Exclude<QuestionId, 'free'> | 'smalltalk';
      let line: string;
      if (a.type === 'ask') {
        if (!QUESTIONS[a.question]) fail('Unknown question.');
        if (v.exchanges.some((e) => e.questionId === a.question)) fail('You already asked that.');
        q = a.question;
        line = QUESTIONS[a.question];
        s.counters.questions++;
      } else {
        const text = String(a.text ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
        if (text.length < 2) fail('Type a question.');
        q = classify(text);
        line = text;
        s.counters.freeQuestions++;
      }
      s.actions -= QUESTION_COST;
      newExchange(s, now, v, { kind: 'question', guardLine: line, questionId: a.type === 'ask' ? a.question : 'free' },
        () => ({ answer: npcAnswer(s, v, q) }), () => zombieOptions(s, v, q));
      break;
    }
    case 'request': {
      if (s.phase !== 'visit') fail('Nobody is at the window.');
      const v = currentVisitor(s);
      if (pendingExchange(v)) fail('Wait for an answer.');
      if (!REQUESTS[a.request]) fail('Unknown request.');
      if (!canRequest(v)[a.request]) fail('Not possible right now.');
      if (s.actions < REQUEST_COST) fail('No actions left.');
      s.actions -= REQUEST_COST;
      s.counters.requests++;
      const r = a.request;
      newExchange(s, now, v, { kind: 'request', guardLine: REQUESTS[r], requestId: r },
        () => {
          let p = 0.9;
          if (v.herrings.includes('shy') && (r === 'mouth' || r === 'hands')) p = 0.3;
          if (r === 'sunglasses') p = 0.75;
          if (r === 'bandage') p = 0.7;
          const ok = chance(s, p);
          return { answer: ok ? pick(s, COMPLY_LINES[r]) : pick(s, REFUSE_LINES[r]), complied: ok };
        },
        () => [pick(s, COMPLY_LINES[r]), ...REFUSE_LINES[r]]);
      break;
    }
    case 'tool': {
      if (s.phase !== 'visit') fail('Nobody is at the window.');
      const v = currentVisitor(s);
      if (!TOOL_ORDER.includes(a.tool)) fail('Unknown tool.');
      const block = toolBlock(s, v, a.tool);
      if (block) fail(block);
      s.actions -= TOOLS[a.tool].cost;
      s.counters.tools++;
      v.tools[a.tool] = runTool(s, v, a.tool);
      if (v.isZombie) log(s, now, `The guard used: ${TOOLS[a.tool].name}.`, 'warn', 'zombie');
      break;
    }
    case 'decide': {
      if (s.phase !== 'visit') fail('Nobody is at the window.');
      const v = currentVisitor(s);
      if (pendingExchange(v)) fail('Wait for an answer first.');
      if (a.decision !== 'approve' && a.decision !== 'deny') fail('Approve or deny.');
      v.decision = a.decision;
      if (v.isZombie) {
        return a.decision === 'approve' ? finish(s, 'zombie', 'ZOMBIE_ADMITTED', now) : finish(s, 'guard', 'ZOMBIE_DENIED', now);
      }
      if (a.decision === 'approve') {
        s.counters.innocentsApproved++;
        s.trust = Math.min(100, s.trust + CONFIG.approveInnocent);
        log(s, now, `APPROVED: ${v.name} walks inside.`, 'good', 'guard');
      } else {
        s.counters.innocentsDenied++;
        s.trust = Math.max(0, s.trust + CONFIG.denyInnocent);
        log(s, now, `DENIED: ${v.name} is sent back into the dark.`, 'warn', 'guard');
      }
      log(s, now, `The guard ${a.decision === 'approve' ? 'approved' : 'DENIED'} visitor #${v.index + 1} (human).`, a.decision === 'approve' ? 'info' : 'good', 'zombie');
      if (s.trust <= 0) return finish(s, 'zombie', 'TRUST_COLLAPSE', now);
      s.phase = 'between';
      break;
    }
    case 'next_visitor': {
      if (s.phase !== 'between') fail('Finish with the current visitor first.');
      arriveNext(s, now);
      break;
    }
    default:
      fail('That action is not available to the guard.');
  }
}

function zombieAction(s: MatchState, a: AnyAction, now: number) {
  const z = s.zombie;
  switch (a.type) {
    case 'prepare': {
      if (z.arrived) fail('You are already in line.');
      if (!['A', 'B', 'C'].includes(a.identity)) fail('Unknown identity.');
      const covers = [...new Set(a.covers ?? [])];
      if (covers.length > CONFIG.zombieCovers) fail(`Pick at most ${CONFIG.zombieCovers} disguise items.`);
      if (covers.some((c) => !COVERS[c])) fail('Unknown item.');
      z.chosen = a.identity;
      z.covers = covers;
      z.prepared = true;
      log(s, now, `Disguise ready: ${z.identityOptions.find((o) => o.key === a.identity)!.visitor.name}${covers.length ? ` with ${covers.map((c) => COVERS[c].name.toLowerCase()).join(' + ')}` : ''}.`, 'good', 'zombie');
      break;
    }
    case 'queue': {
      if (z.arrived) fail('You are already here.');
      if (a.on && !z.prepared) fail('Prepare your disguise first.');
      z.queued = !!a.on;
      log(s, now, z.queued ? 'You step into line. You will be the next visitor.' : 'You step back into the shadows.', 'info', 'zombie');
      break;
    }
    case 'sabotage': {
      if (!SABOTAGE[a.kind]) fail('Unknown sabotage.');
      if (z.arrived) fail('You are already inside the checkpoint area.');
      if (z.sabotage[a.kind] <= 0) fail('Already used.');
      if (z.pendingSabotage.includes(a.kind)) fail('Already set for the next visitor.');
      z.sabotage[a.kind]--;
      z.pendingSabotage.push(a.kind);
      s.counters.sabotageUsed++;
      log(s, now, `${SABOTAGE[a.kind].name}: it hits during the next visit.`, 'good', 'zombie');
      break;
    }
    case 'respond': {
      if (s.phase !== 'visit') fail('Nobody is being questioned.');
      const v = currentVisitor(s);
      if (!v.isZombie) fail('You are not at the window.');
      const e = v.exchanges.find((x) => x.id === a.exchangeId);
      if (!e || e.answer !== null) fail('Nothing to answer.');
      const i = Number(a.option);
      if (!Number.isInteger(i) || i < 0 || i >= e.options.length) fail('Invalid option.');
      e.answer = e.options[i];
      if (e.kind === 'request') e.complied = i === 0;
      e.answeredAt = now;
      const [lo, hi] = CONFIG.zombieMinDelayMs;
      e.revealAt = Math.max(now, e.askedAt + Math.round(lo + rand(s) * (hi - lo)));
      break;
    }
    default:
      fail('That action is not available to the infiltrator.');
  }
}

export function forfeit(prev: MatchState, loser: Role, now: number): MatchState {
  const s = structuredClone(prev);
  finish(s, loser === 'guard' ? 'zombie' : 'guard', 'FORFEIT', now);
  return s;
}

/** Earliest future moment at which time alone changes the state (for client ticks). */
export function nextTimerAt(s: MatchState): number | null {
  const v = s.visitors[s.current];
  if (!v || s.phase !== 'visit') return null;
  let t: number | null = null;
  for (const e of v.exchanges) {
    if (e.revealed) continue;
    const at = e.answer === null ? e.deadline : e.revealAt;
    if (at !== null && (t === null || at < t)) t = at;
  }
  return t;
}

// ------------------------------------------------------------------ views

function visitorView(v: Visitor, role: Role): VisitorView {
  return {
    id: v.id,
    index: v.index,
    appearance: appearance(v),
    card: structuredClone(v.card),
    tools: structuredClone(v.tools),
    exchanges: v.exchanges.map((e): ExchangeView => {
      const mine = role === 'zombie' && v.isZombie && e.answer !== null; // the zombie sees its own answer immediately
      const visible = e.revealed || mine;
      return {
        id: e.id, kind: e.kind, guardLine: e.guardLine,
        answer: visible ? e.answer : null,
        pending: !e.revealed,
        ...(visible && e.kind === 'request' ? { complied: e.complied } : {}),
      };
    }),
    greeting: v.greeting,
    decision: v.decision,
    canRequest: canRequest(v),
  };
}

function resultView(s: MatchState, now: number): ResultView | null {
  if (s.phase !== 'finished' || !s.winner || !s.winReason) return null;
  return {
    winner: s.winner,
    reason: s.winReason,
    headline: WIN_HEADLINES[s.winReason],
    visitors: s.visitors.map((v) => ({
      index: v.index, name: v.name, isZombie: v.isZombie, decision: v.decision, appearance: appearance(v, true),
      anomalies: [...v.anomalies], covers: [...v.covers], herrings: [...v.herrings],
    })),
    counters: { ...s.counters },
    durationSec: Math.round(((s.endedAt ?? now) - s.startedAt) / 1000),
    trust: s.trust,
  };
}

export function buildView(s: MatchState, role: Role, now: number): PlayerView {
  const v = s.visitors[s.current];
  const base = {
    phase: s.phase,
    current: s.current,
    total: s.total,
    trust: s.trust,
    actions: s.actions,
    actionsMax: s.actionsMax,
    visitor: v ? visitorView(v, role) : null,
    active: { ...s.active },
    log: s.log.filter((l) => l.to === 'all' || l.to === role).slice(-30).map((l) => ({ t: l.t, kind: l.kind, text: l.text })),
    result: resultView(s, now),
    serverNow: now,
  };

  if (role === 'guard') {
    const tools: ToolInfo[] = TOOL_ORDER.map((id) => {
      const reason = v ? toolBlock(s, v, id) : 'Nobody here';
      return { id, name: TOOLS[id].name, cost: TOOLS[id].cost, available: !reason, reason };
    });
    const view: GuardView = {
      ...base,
      role: 'guard',
      tools,
      questions: QUESTION_ORDER.map((id) => ({ id, text: QUESTIONS[id], asked: !!v?.exchanges.some((e) => e.questionId === id) })),
      requestCost: REQUEST_COST,
      pending: !!pendingExchange(v),
    };
    return view;
  }

  const z = s.zombie;
  const zv = s.visitors.find((x) => x.isZombie);
  const ident = zv ?? z.identityOptions.find((o) => o.key === (z.chosen ?? 'A'))!.visitor;
  const memory = {} as Record<FactKey, string | null>;
  for (const f of ['origin', 'dob', 'job', 'contact'] as FactKey[]) {
    const knowsFromDb = !!zv?.tools.database && zv.record.status !== 'none' && (f === 'job' || f === 'contact');
    memory[f] = ident.memory[f] || knowsFromDb ? ident.truth[f] : null;
  }
  const atWindow = !!v?.isZombie && s.phase === 'visit';
  const pe = atWindow ? v!.exchanges.find((e) => e.answer === null && !e.revealed) : undefined;
  const exposed: Anomaly[] = [];
  if (zv) {
    const ap = appearance(zv);
    if (ap.eyes === 'clouded') exposed.push('eyes');
    if (ap.skin === 'grey') exposed.push('skin');
    if (zv.tools.thermometer?.severity === 'alarming') exposed.push('cold');
    if (ap.mouth === 'black') exposed.push('gums');
    if (ap.hands === 'grey') exposed.push('nails');
    if (ap.neck === 'bite') exposed.push('bite');
  }
  const view: ZombieView = {
    ...base,
    role: 'zombie',
    prepared: z.prepared,
    queued: z.queued,
    arrived: z.arrived,
    atWindow,
    mustEnterBy: s.total,
    identityOptions: z.identityOptions.map((o) => ({
      key: o.key, label: o.label, risk: o.risk, card: structuredClone(o.visitor.card), record: structuredClone(o.visitor.record), look: { ...o.visitor.look },
    })),
    chosen: z.chosen,
    covers: [...z.covers],
    anomalies: [...z.anomalies],
    memory,
    sabotage: { ...z.sabotage },
    pendingSabotage: [...z.pendingSabotage],
    prompt: pe ? { exchangeId: pe.id, kind: pe.kind === 'request' ? 'request' : 'question', text: pe.guardLine, options: [...pe.options], deadline: pe.deadline } : null,
    exposed,
  };
  return view;
}
