export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export function getName(): string {
  try { return localStorage.getItem('tlc-name') ?? ''; } catch { return ''; }
}
export function setName(n: string) {
  try { localStorage.setItem('tlc-name', n.slice(0, 20)); } catch { /* ignore */ }
}

/** Base path the app is served from: "/" on Vercel, "/<repo>/" on GitHub Pages. */
export const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');

export function inviteUrl(code: string) {
  return `${window.location.origin}${BASE}/join/${code}`;
}

export function navigate(path: string) {
  window.history.pushState({}, '', `${BASE}${path}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function fmtDuration(sec: number) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
