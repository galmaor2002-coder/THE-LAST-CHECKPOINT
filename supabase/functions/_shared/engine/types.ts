// THE LAST CHECKPOINT — v2 "anomaly checkpoint" types.
// The engine runs ONLY on the server. Clients receive role-filtered views.

export type Role = 'guard' | 'zombie';
export type Phase = 'visit' | 'between' | 'finished';
export type Decision = 'approve' | 'deny';
export type Demeanor = 'calm' | 'nervous' | 'chatty' | 'grumpy' | 'quiet';

/** Zombie anomalies (true tells). */
export type Anomaly = 'eyes' | 'skin' | 'cold' | 'gums' | 'nails' | 'bite';
/** Disguise items the zombie can wear. NPCs may wear sunglasses/bandage too, for innocent reasons. */
export type Cover = 'sunglasses' | 'makeup' | 'heatpack' | 'bandage';
/** Innocent red herrings. */
export type Herring = 'sunglasses' | 'pale' | 'tired' | 'fever' | 'chilled' | 'bandage' | 'yellowTeeth' | 'dirtyNails' | 'expired' | 'unregistered' | 'noAnswer' | 'shy';

export type ToolId = 'database' | 'phone' | 'thermometer' | 'flashlight';
export type RequestId = 'sunglasses' | 'mouth' | 'hands' | 'bandage';
export type QuestionId = 'name' | 'origin' | 'dob' | 'job' | 'contact' | 'reason' | 'bitten' | 'free';
export type FactKey = 'origin' | 'dob' | 'job' | 'contact';
export type Sabotage = 'phone' | 'database' | 'distraction';
export type DbStatus = 'active' | 'missing' | 'none';

export type WinReason = 'ZOMBIE_DENIED' | 'ZOMBIE_ADMITTED' | 'TRUST_COLLAPSE' | 'FORFEIT';

/** Everything needed to draw a face. */
export interface Look {
  skin: number; // palette index
  hair: number; // style index
  hairColor: number;
  eyeColor: number;
  face: number; // head shape
  nose: number;
  brows: number;
  beard: number; // 0 none
  shirt: number;
  hat: number; // 0 none
  glasses: boolean; // prescription glasses (part of identity)
}

/** What the guard can currently SEE on the visitor (computed server-side). */
export interface Appearance {
  look: Look;
  eyes: 'normal' | 'clouded' | 'red' | 'hidden';
  skin: 'normal' | 'grey' | 'pale';
  sunglasses: boolean;
  neck: 'clear' | 'bandage' | 'bite' | 'stitches';
  mouth: null | 'normal' | 'black' | 'yellow'; // null = not shown
  hands: null | 'normal' | 'grey' | 'dirty'; // null = not shown
}

export interface IdCard {
  name: string;
  dob: string; // "14 MAR 1991"
  idNumber: string;
  origin: string;
  expires: string;
  expired: boolean;
  photo: Look; // the face printed on the card (may differ from the visitor!)
}

export interface DbRecord {
  status: DbStatus;
  name: string;
  job: string;
  contact: string; // "Sara Levin (sister)"
  note: string;
}

export interface Exchange {
  id: number;
  kind: 'question' | 'request' | 'greeting' | 'tool';
  guardLine: string;
  questionId?: QuestionId;
  requestId?: RequestId;
  options: string[]; // zombie only (last options are deflect/refuse)
  answer: string | null; // chosen/generated line
  complied?: boolean; // for requests
  askedAt: number;
  deadline: number;
  answeredAt: number | null;
  revealAt: number | null;
  revealed: boolean;
}

export interface ToolResult {
  tool: ToolId;
  title: string;
  lines: string[];
  severity: 'normal' | 'odd' | 'alarming';
}

export interface Visitor {
  id: string;
  index: number; // 0..5
  isZombie: boolean;
  name: string;
  age: number;
  look: Look;
  card: IdCard;
  record: DbRecord;
  truth: { origin: string; dob: string; job: string; contact: string; reason: string };
  greeting: string;
  demeanor: Demeanor;
  anomalies: Anomaly[];
  covers: Cover[];
  herrings: Herring[];
  phoneReply: string;
  memory: Partial<Record<FactKey, boolean>>;
  removed: Partial<Record<'sunglasses' | 'bandage', boolean>>;
  shown: Partial<Record<'mouth' | 'hands', boolean>>;
  tools: Partial<Record<ToolId, ToolResult>>;
  exchanges: Exchange[];
  decision: Decision | null;
}

export interface IdentityOption {
  key: 'A' | 'B' | 'C';
  label: string;
  risk: string;
  visitor: Visitor; // pre-built disguise (server-side)
}

export interface LogEntry {
  t: number;
  text: string;
  kind: 'info' | 'warn' | 'danger' | 'good' | 'event';
  to: 'all' | Role;
}

export interface MatchState {
  schema: 2;
  phase: Phase;
  rng: number;
  nextId: number;
  total: number; // visitors per shift
  current: number; // index of visitor at the window
  visitors: Visitor[]; // visitors that have arrived so far
  actions: number; // guard actions left for the current visitor
  actionsMax: number;
  trust: number;
  zombie: {
    prepared: boolean;
    queued: boolean; // will take the next slot
    arrived: boolean;
    identityOptions: IdentityOption[];
    chosen: 'A' | 'B' | 'C' | null;
    covers: Cover[];
    anomalies: Anomaly[];
    sabotage: Record<Sabotage, number>;
    pendingSabotage: Sabotage[]; // applies to the next visitor
  };
  active: { phoneDead: boolean; dbDown: boolean; distracted: boolean };
  log: LogEntry[];
  processed: string[];
  counters: {
    questions: number; freeQuestions: number; requests: number; tools: number;
    innocentsApproved: number; innocentsDenied: number; sabotageUsed: number;
  };
  winner: Role | null;
  winReason: WinReason | null;
  startedAt: number;
  endedAt: number | null;
}

// ------------------------------------------------------------------ actions

export type GuardAction =
  | { type: 'ask'; question: Exclude<QuestionId, 'free'> }
  | { type: 'ask_free'; text: string }
  | { type: 'request'; request: RequestId }
  | { type: 'tool'; tool: ToolId }
  | { type: 'decide'; decision: Decision }
  | { type: 'next_visitor' };

export type ZombieAction =
  | { type: 'prepare'; identity: 'A' | 'B' | 'C'; covers: Cover[] }
  | { type: 'queue'; on: boolean }
  | { type: 'sabotage'; kind: Sabotage }
  | { type: 'respond'; exchangeId: number; option: number };

export type AnyAction = (GuardAction | ZombieAction | { type: 'tick' }) & { actionId?: string };

// ------------------------------------------------------------------ views

export interface ExchangeView {
  id: number;
  kind: Exchange['kind'];
  guardLine: string;
  answer: string | null; // null while pending (guard) — "…"
  pending: boolean;
  complied?: boolean;
}

export interface VisitorView {
  id: string;
  index: number;
  appearance: Appearance;
  card: IdCard;
  tools: Partial<Record<ToolId, ToolResult>>;
  exchanges: ExchangeView[];
  greeting: string;
  decision: Decision | null;
  canRequest: Record<RequestId, boolean>;
}

export interface BaseView {
  role: Role;
  phase: Phase;
  current: number;
  total: number;
  trust: number;
  actions: number;
  actionsMax: number;
  visitor: VisitorView | null;
  active: MatchState['active'];
  log: Omit<LogEntry, 'to'>[];
  result: ResultView | null;
  serverNow: number;
}

export interface ToolInfo {
  id: ToolId;
  name: string;
  cost: number;
  available: boolean;
  reason: string | null;
}

export interface GuardView extends BaseView {
  role: 'guard';
  tools: ToolInfo[];
  questions: { id: Exclude<QuestionId, 'free'>; text: string; asked: boolean }[];
  requestCost: number;
  pending: boolean;
}

export interface ZombieView extends BaseView {
  role: 'zombie';
  prepared: boolean;
  queued: boolean;
  arrived: boolean;
  atWindow: boolean; // the zombie is the visitor at the window right now
  mustEnterBy: number;
  identityOptions: { key: 'A' | 'B' | 'C'; label: string; risk: string; card: IdCard; record: DbRecord; look: Look }[];
  chosen: 'A' | 'B' | 'C' | null;
  covers: Cover[];
  anomalies: Anomaly[];
  memory: Record<FactKey, string | null>;
  sabotage: Record<Sabotage, number>;
  pendingSabotage: Sabotage[];
  prompt: { exchangeId: number; kind: 'question' | 'request'; text: string; options: string[]; deadline: number } | null;
  exposed: Anomaly[]; // anomalies the guard has had a chance to notice
}

export interface ResultView {
  winner: Role;
  reason: WinReason;
  headline: string;
  visitors: {
    index: number; name: string; isZombie: boolean; decision: Decision | null; appearance: Appearance;
    anomalies: Anomaly[]; covers: Cover[]; herrings: Herring[];
  }[];
  counters: MatchState['counters'];
  durationSec: number;
  trust: number;
}

export type PlayerView = GuardView | ZombieView;
