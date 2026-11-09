import { describe, expect, test } from 'vitest';
import { applyAction, buildView, createMatch, nextTimerAt } from '../supabase/functions/_shared/engine/engine.ts';
import type { AnyAction, MatchState, Role } from '../supabase/functions/_shared/engine/types.ts';

const T0 = 1_700_000_000_000;

function act(s: MatchState, role: Role, a: AnyAction, now = T0 + 1000) {
  return applyAction(s, role, a, now).state;
}
const tick = (s: MatchState, now: number) => applyAction(s, 'guard', { type: 'tick' }, now).state;

/** Advance the shift until the zombie is at the window (zombie queues immediately). */
function toZombie(seed: number): { s: MatchState; now: number } {
  let s = createMatch(seed, T0);
  let now = T0 + 1000;
  s = act(s, 'zombie', { type: 'prepare', identity: 'A', covers: [] }, now);
  s = act(s, 'zombie', { type: 'queue', on: true }, now);
  s = act(s, 'guard', { type: 'decide', decision: 'approve' }, now);
  s = act(s, 'guard', { type: 'next_visitor' }, now);
  return { s, now };
}

const SECRET_KEYS = ['isZombie', 'anomalies', 'covers', 'herrings', 'truth', 'record', 'phoneReply', 'memory', 'demeanor',
  'options', 'identityOptions', 'zombie', 'revealAt', 'answeredAt', 'deadline', 'rng', 'exposed', 'prompt'];

function keysOf(o: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(o)) o.forEach((x) => keysOf(x, out));
  else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { out.add(k); keysOf(v, out); }
  return out;
}

describe('shift setup', () => {
  test('first visitor is always human, zombie has 3 anomalies and 3 identities', () => {
    for (let seed = 1; seed < 50; seed++) {
      const s = createMatch(seed, T0);
      expect(s.visitors).toHaveLength(1);
      expect(s.visitors[0].isZombie).toBe(false);
      expect(s.zombie.anomalies).toHaveLength(3);
      expect(s.zombie.identityOptions.map((o) => o.key)).toEqual(['A', 'B', 'C']);
      expect(s.phase).toBe('visit');
    }
  });

  test('zombie is forced in at the last slot', () => {
    let s = createMatch(5, T0);
    for (let i = 0; i < 5; i++) {
      expect(s.visitors[s.current].isZombie).toBe(false);
      s = act(s, 'guard', { type: 'decide', decision: 'approve' });
      s = act(s, 'guard', { type: 'next_visitor' });
    }
    expect(s.current).toBe(5);
    expect(s.visitors[5].isZombie).toBe(true);
  });

  test('queueing puts the zombie at the next slot', () => {
    const { s } = toZombie(7);
    expect(s.current).toBe(1);
    expect(s.visitors[1].isZombie).toBe(true);
  });
});

describe('hidden information', () => {
  test('guard view never contains secret fields — NPC and zombie visits, all interactions', () => {
    for (let seed = 1; seed <= 60; seed++) {
      let { s, now } = toZombie(seed);
      s = act(s, 'guard', { type: 'ask', question: 'job' }, now);
      const pendingV = buildView(s, 'guard', now);
      for (const k of SECRET_KEYS) expect(keysOf(pendingV).has(k)).toBe(false);
      s = act(s, 'zombie', { type: 'respond', exchangeId: s.visitors[1].exchanges.at(-1)!.id, option: 0 }, now + 500);
      // Before the reveal moment, the guard's view must be byte-identical whether or not the zombie answered.
      const before = JSON.stringify({ ...buildView(s, 'guard', now + 600), serverNow: 0 });
      expect(before).toBe(JSON.stringify({ ...pendingV, serverNow: 0 }));
      s = tick(s, now + 20_000);
      for (const tool of ['thermometer', 'database', 'phone'] as const) s = act(s, 'guard', { type: 'tool', tool }, now + 20_000);
      const v = buildView(s, 'guard', now + 20_000);
      for (const k of SECRET_KEYS) expect(keysOf(v).has(k)).toBe(false);
      expect(JSON.stringify(v)).not.toMatch(/You are visitor|Disguise ready|hesitated|The guard used/);
    }
  });

  test('NPC answers stay hidden until their reveal time', () => {
    let s = createMatch(3, T0);
    s = act(s, 'guard', { type: 'ask', question: 'origin' }, T0);
    expect(buildView(s, 'guard', T0).visitor!.exchanges.at(-1)!.answer).toBeNull();
    const at = nextTimerAt(s)!;
    expect(at - T0).toBeGreaterThanOrEqual(2200);
    s = tick(s, at - 1);
    expect(buildView(s, 'guard', at).visitor!.exchanges.at(-1)!.answer).toBeNull();
    s = tick(s, at);
    expect(buildView(s, 'guard', at).visitor!.exchanges.at(-1)!.answer).toBeTruthy();
  });

  test('a zombie that answers instantly is still delayed like a human', () => {
    let { s, now } = toZombie(9);
    s = act(s, 'guard', { type: 'ask', question: 'name' }, now);
    const e = s.visitors[1].exchanges.at(-1)!;
    s = act(s, 'zombie', { type: 'respond', exchangeId: e.id, option: 0 }, now + 10);
    expect(s.visitors[1].exchanges.at(-1)!.revealed).toBe(false);
    expect(nextTimerAt(s)! - now).toBeGreaterThanOrEqual(1800);
  });

  test('zombie timeout auto-deflects', () => {
    let { s, now } = toZombie(10);
    s = act(s, 'guard', { type: 'request', request: 'mouth' }, now);
    s = tick(s, now + 16_000);
    const e = s.visitors[1].exchanges.at(-1)!;
    expect(e.revealed).toBe(true);
    expect(e.complied).toBe(false);
    expect(s.visitors[1].shown.mouth).toBeFalsy();
  });

  test('complying with a request reveals that body part, after the delay', () => {
    let { s, now } = toZombie(11);
    s = act(s, 'guard', { type: 'request', request: 'hands' }, now);
    s = act(s, 'zombie', { type: 'respond', exchangeId: s.visitors[1].exchanges.at(-1)!.id, option: 0 }, now + 100);
    expect(buildView(s, 'guard', now + 200).visitor!.appearance.hands).toBeNull();
    s = tick(s, now + 5000);
    expect(buildView(s, 'guard', now + 5000).visitor!.appearance.hands).not.toBeNull();
  });
});

describe('rules', () => {
  test('actions are limited per visitor', () => {
    let s = createMatch(12, T0);
    let now = T0;
    for (const q of ['name', 'origin', 'dob', 'job', 'contact', 'reason'] as const) {
      s = act(s, 'guard', { type: 'ask', question: q }, now);
      now += 15_000; s = tick(s, now);
    }
    expect(s.actions).toBe(0);
    expect(() => act(s, 'guard', { type: 'ask', question: 'bitten' }, now)).toThrow();
  });

  test('cannot decide while an answer is pending', () => {
    let s = createMatch(13, T0);
    s = act(s, 'guard', { type: 'ask', question: 'name' }, T0);
    expect(() => act(s, 'guard', { type: 'decide', decision: 'deny' }, T0 + 100)).toThrow();
  });

  test('flashlight needs the sunglasses off', () => {
    let { s, now } = toZombie(14);
    s.visitors[1].covers = ['sunglasses'];
    expect(() => act(s, 'guard', { type: 'tool', tool: 'flashlight' }, now)).toThrow(/Sunglasses/);
  });

  test('sabotage hits the next visitor', () => {
    let s = createMatch(15, T0);
    s = act(s, 'zombie', { type: 'sabotage', kind: 'phone' });
    s = act(s, 'zombie', { type: 'sabotage', kind: 'distraction' });
    expect(s.active.phoneDead).toBe(false);
    s = act(s, 'guard', { type: 'decide', decision: 'approve' });
    s = act(s, 'guard', { type: 'next_visitor' });
    expect(s.active.phoneDead).toBe(true);
    expect(s.actions).toBe(s.actionsMax - 2);
    expect(() => act(s, 'guard', { type: 'tool', tool: 'phone' })).toThrow();
    expect(() => act(s, 'zombie', { type: 'sabotage', kind: 'phone' })).toThrow();
  });

  test('covers hide anomalies', () => {
    let s = createMatch(16, T0);
    s.zombie.anomalies = ['skin', 'cold', 'eyes'];
    s = act(s, 'zombie', { type: 'prepare', identity: 'B', covers: ['makeup', 'heatpack'] });
    s = act(s, 'zombie', { type: 'queue', on: true });
    s = act(s, 'guard', { type: 'decide', decision: 'approve' });
    s = act(s, 'guard', { type: 'next_visitor' });
    const ap = buildView(s, 'guard', T0).visitor!.appearance;
    expect(ap.skin).toBe('normal');
    expect(ap.eyes).toBe('clouded');
    s = act(s, 'guard', { type: 'tool', tool: 'thermometer' });
    expect(s.visitors[1].tools.thermometer!.severity).not.toBe('alarming');
  });

  test('only 2 disguise items', () => {
    const s = createMatch(17, T0);
    expect(() => act(s, 'zombie', { type: 'prepare', identity: 'A', covers: ['makeup', 'heatpack', 'bandage'] })).toThrow();
  });

  test('duplicate actionId ignored', () => {
    let s = createMatch(18, T0);
    s = act(s, 'guard', { type: 'tool', tool: 'thermometer', actionId: 'x1' });
    const r = applyAction(s, 'guard', { type: 'tool', tool: 'thermometer', actionId: 'x1' }, T0);
    expect(r.duplicate).toBe(true);
  });

  test('free-text questions are understood or answered with small talk', () => {
    let s = createMatch(19, T0);
    s = act(s, 'guard', { type: 'ask_free', text: 'So what did you do for work?' }, T0);
    s = tick(s, T0 + 20_000);
    const a = s.visitors[0].exchanges.at(-1)!.answer!;
    expect(a.length).toBeGreaterThan(0);
  });
});

describe('win conditions', () => {
  test('deny the zombie → guard wins', () => {
    let { s, now } = toZombie(21);
    s = act(s, 'guard', { type: 'decide', decision: 'deny' }, now);
    expect(s.winner).toBe('guard');
    expect(s.winReason).toBe('ZOMBIE_DENIED');
    const r = buildView(s, 'guard', now).result!;
    expect(r.visitors.find((v) => v.isZombie)).toBeTruthy();
  });

  test('approve the zombie → zombie wins', () => {
    let { s, now } = toZombie(22);
    s = act(s, 'guard', { type: 'decide', decision: 'approve' }, now);
    expect(s.winner).toBe('zombie');
    expect(s.winReason).toBe('ZOMBIE_ADMITTED');
  });

  test('denying everyone collapses trust before the zombie arrives if it waits', () => {
    let s = createMatch(23, T0);
    for (let i = 0; i < 6 && s.phase !== 'finished'; i++) {
      s = act(s, 'guard', { type: 'decide', decision: 'deny' });
      if (s.phase === 'between') s = act(s, 'guard', { type: 'next_visitor' });
    }
    expect(s.winner).toBe('zombie');
    expect(s.winReason).toBe('TRUST_COLLAPSE');
  });
});
