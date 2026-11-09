import type { Anomaly, Cover, Demeanor, Herring, QuestionId, RequestId, Sabotage, ToolId } from './types.ts';

export const WORLD_YEAR = 2031;

export const CONFIG = {
  visitors: 6,
  actionsPerVisitor: 6,
  startTrust: 100,
  denyInnocent: -25,
  approveInnocent: 5,
  zombieAnomalies: 3,
  zombieCovers: 2,
  answerTimeoutMs: 15_000,
  npcDelayMs: [2200, 7000] as const,
  zombieMinDelayMs: [1800, 3200] as const,
  firstZombieSlot: 1, // the zombie can never be visitor #1 (gives time to prepare)
};

export const FIRST = ['Mara', 'Daniel', 'Yusuf', 'Lena', 'Tomas', 'Amira', 'Viktor', 'Noa', 'Elias', 'Priya', 'Marcus', 'Ines',
  'Jonah', 'Sofia', 'Rafael', 'Hana', 'Dmitri', 'Leila', 'Owen', 'Zara', 'Kofi', 'Elena', 'Bram', 'Yara', 'Luca', 'Mei',
  'Samir', 'Clara', 'Idris', 'Talia', 'Felix', 'Rosa', 'Arjun', 'Greta', 'Malik', 'Nadia', 'Theo', 'Ayla', 'Hugo', 'Esther'];
export const LAST = ['Okafor', 'Brandt', 'Haddad', 'Novak', 'Reyes', 'Lindqvist', 'Moreau', 'Kowalski', 'Tanaka', 'Ivers',
  'Castillo', 'Weiss', 'Adeyemi', 'Farrow', 'Petrov', 'Sorensen', 'Mendes', 'Quinn', 'Varga', 'Halloran', 'Duarte',
  'Strand', 'Kaplan', 'Rossi', 'Vance', 'Kerr', 'Lazar', 'Levin', 'Amar', 'Shapiro'];
export const ORIGINS = ['the Northern Shelter', 'Riverside Camp', 'the Old Harbor', 'Mill Valley', 'the Route 9 convoy',
  "St. Agnes Hospital", 'the Eastgate mall', 'Pine Ridge farms', 'the university dorms', 'the rail yard camp'];
export const JOBS = ['nurse', 'electrician', 'teacher', 'mechanic', 'bus driver', 'line cook', 'paramedic', 'accountant',
  'carpenter', 'pharmacist', 'farmer', 'radio operator'];
export const RELATIONS = ['sister', 'brother', 'mother', 'father', 'husband', 'wife', 'friend', 'cousin', 'neighbour'];
export const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
export const REASONS = [
  'I need somewhere safe to sleep. Just one night.',
  'My sister is inside. I have to see her.',
  'I can fix generators. You need people like me.',
  "I've been walking for nine days. Please.",
  'I heard the radio broadcast. It said this place was safe.',
  "There's nothing left out there. Nothing.",
];
export const GREETINGS = ['Good evening.', 'Hello... is this the checkpoint?', 'Please. I just need to get inside.', 'Evening, officer.', "Hi. It's cold out here.", 'Good evening, sir.'];

export const QUESTIONS: Record<Exclude<QuestionId, 'free'>, string> = {
  name: "What's your name?",
  origin: 'Where are you coming from?',
  dob: "What's your date of birth?",
  job: 'What did you do before all this?',
  contact: "Who's your emergency contact?",
  reason: 'Why do you need to get in?',
  bitten: 'Have you been bitten or scratched?',
};
export const QUESTION_ORDER = Object.keys(QUESTIONS) as Exclude<QuestionId, 'free'>[];

export const REQUESTS: Record<RequestId, string> = {
  sunglasses: 'Take off your sunglasses.',
  mouth: 'Open your mouth. Show me your gums.',
  hands: 'Hands on the glass. Fingers spread.',
  bandage: 'Remove that bandage.',
};

export const COMPLY_LINES: Record<RequestId, string[]> = {
  sunglasses: ['Fine.', 'Sure... the light hurts, but okay.'],
  mouth: ['Ahh...', 'Okay. Look.'],
  hands: ['Here.', 'Like this?'],
  bandage: ["It's not pretty...", 'Careful, it still hurts.'],
};
export const REFUSE_LINES: Record<RequestId, string[]> = {
  sunglasses: ['No. My eyes are bad. The light burns.', "I'd rather not. Doctor's orders."],
  mouth: ['What? No. That is humiliating.', "I'm not doing that through a window."],
  hands: ["My hands are frozen, I can't.", 'Why? You can see me fine.'],
  bandage: ["If I take it off it'll bleed again.", 'No. It took me an hour to stop the bleeding.'],
};

export const DEFLECTS: Record<Demeanor, string[]> = {
  calm: ["I'd rather not get into that.", "Does it matter? I'm here now."],
  nervous: ["I... I don't remember. Everything's a blur.", 'Please, I just need to get in.'],
  chatty: ["Oh, that's a long story. Long, long story.", 'Honestly? I lost track of all that months ago.'],
  grumpy: ['Why does that matter?', "I've answered enough questions."],
  quiet: ['...', "Don't know."],
};
export const SMALLTALK: Record<Demeanor, string[]> = {
  calm: ["I'm not sure what you mean.", 'Sorry?'],
  nervous: ['W-what? Sorry, I... what?', "I don't understand. Am I in trouble?"],
  chatty: ["Ha, well, you could say that. It's been a strange year.", 'Funny question. I guess so?'],
  grumpy: ["What kind of question is that?", 'Just let me in.'],
  quiet: ['...', 'Hm.'],
};
export const BITTEN = { no: 'No. Nothing.', scratch: 'Just a scratch from a fence.', old: 'A dog, months ago. It healed.' };

/** Free-text question classifier (English keywords). Unknown → smalltalk. */
export const INTENTS: { id: Exclude<QuestionId, 'free'>; words: RegExp }[] = [
  { id: 'name', words: /\b(name|called|who are you)\b/i },
  { id: 'dob', words: /\b(born|birth|birthday|how old|age)\b/i },
  { id: 'origin', words: /\b(where|from|come from|coming from|came|travel)\b/i },
  { id: 'job', words: /\b(job|work|occupation|profession|did you do|career)\b/i },
  { id: 'contact', words: /\b(contact|family|relative|vouch|sister|brother|mother|father|wife|husband|anyone)\b/i },
  { id: 'bitten', words: /\b(bit|bite|bitten|scratch|wound|hurt|injur|infect)\b/i },
  { id: 'reason', words: /\b(why|reason|purpose|want|need)\b/i },
];

export const TOOLS: Record<ToolId, { name: string; cost: number }> = {
  database: { name: 'Resident database', cost: 1 },
  phone: { name: 'Call emergency contact', cost: 2 },
  thermometer: { name: 'Thermometer', cost: 1 },
  flashlight: { name: 'Flashlight (pupils)', cost: 1 },
};
export const TOOL_ORDER: ToolId[] = ['database', 'phone', 'thermometer', 'flashlight'];
export const REQUEST_COST = 1;
export const QUESTION_COST = 1;

export const ANOMALIES: Anomaly[] = ['eyes', 'skin', 'cold', 'gums', 'nails', 'bite'];
export const COVERS: Record<Cover, { name: string; hides: Anomaly; text: string }> = {
  sunglasses: { name: 'Sunglasses', hides: 'eyes', text: 'Hides clouded eyes. The guard can ask you to take them off.' },
  makeup: { name: 'Makeup', hides: 'skin', text: 'Hides grey skin. Works until the end of the visit.' },
  heatpack: { name: 'Heat pack', hides: 'cold', text: 'Warms you up. The thermometer reads normal.' },
  bandage: { name: 'Bandage', hides: 'bite', text: 'Covers the bite. The guard can ask you to remove it.' },
};
export const ANOMALY_TEXT: Record<Anomaly, string> = {
  eyes: 'Clouded eyes — milky irises, no pupil reaction',
  skin: 'Grey skin — a cold, greenish-grey tint',
  cold: 'Cold body — around 33–34 °C',
  gums: 'Black gums — dark, rotting gums',
  nails: 'Grey nails — cracked, grey fingernails',
  bite: 'Bite mark — on the neck',
};
export const HERRING_TEXT: Record<Herring, string> = {
  sunglasses: 'Wears sunglasses (eye injury)', pale: 'Pale from illness', tired: 'Red, exhausted eyes', fever: 'Fever',
  chilled: 'Chilled from the rain', bandage: 'Bandaged cut (stitches)', yellowTeeth: 'Yellow teeth', dirtyNails: 'Dirty nails',
  expired: 'Expired ID', unregistered: 'Not in the database', noAnswer: 'Contact does not answer', shy: 'Refuses some requests',
};

export const SABOTAGE: Record<Sabotage, { name: string; text: string; uses: number }> = {
  phone: { name: 'Cut the phone line', text: "The guard can't call anyone during the next visit.", uses: 1 },
  database: { name: 'Crash the database', text: 'The database is offline during the next visit.', uses: 1 },
  distraction: { name: 'Distraction', text: 'An alarm costs the guard 2 actions during the next visit.', uses: 1 },
};

export const GUIDE = [
  { title: 'Eyes', body: 'Infected eyes cloud over: milky irises, pupils that do not react to light. Tired eyes are red, not milky.' },
  { title: 'Skin', body: 'A grey-green tint. Sick people can be pale, but pale is not grey.' },
  { title: 'Temperature', body: 'The infected run cold: 33–34 °C. People caught in the rain can be chilly (around 35 °C). Fever is HOT, not cold.' },
  { title: 'Gums', body: 'Black, rotting gums. Bad hygiene gives yellow teeth, but pink gums.' },
  { title: 'Nails', body: 'Grey, cracked nails. Dirty nails are just dirty.' },
  { title: 'Bite', body: 'A crescent of tooth marks, usually on the neck. Bandages hide many things — including honest stitches.' },
  { title: 'Papers', body: 'Compare the face with the ID photo. Check the database: missing people sometimes come back... and sometimes something wearing their face does.' },
  { title: 'Behaviour', body: 'Anyone can refuse a request. Refusing is a choice. Note who makes it.' },
];

export const WIN_HEADLINES = {
  ZOMBIE_DENIED: 'The guard turned the infected away at the window.',
  ZOMBIE_ADMITTED: 'The guard stamped APPROVE. Something walked inside wearing a human face.',
  TRUST_COLLAPSE: 'Too many innocent people were turned away. The survivors opened the gate themselves.',
  FORFEIT: 'The opponent abandoned the shift.',
} as const;

// Look palette sizes (drawn by the client)
export const LOOK = { skin: 6, hair: 7, hairColor: 6, eyeColor: 4, face: 3, nose: 3, brows: 3, beard: 4, shirt: 6, hat: 4 };
