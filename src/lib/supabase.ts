import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True only when real Supabase credentials are present. The game never fakes online play. */
export const isConfigured = Boolean(url && key && !url.includes('YOUR-PROJECT'));

export const supabase: SupabaseClient | null = isConfigured
  ? createClient(url!, key!, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'tlc-auth' },
    realtime: { params: { eventsPerSecond: 20 } },
  })
  : null;

export function sb(): SupabaseClient {
  if (!supabase) throw new Error('Online play is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see README).');
  return supabase;
}

let sessionPromise: Promise<string> | null = null;

/**
 * Guest session: a Supabase anonymous user, persisted in localStorage.
 * Refreshing the page keeps the same user id, which is what makes reconnection work.
 */
export function ensureSession(): Promise<string> {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const client = sb();
      const { data } = await client.auth.getSession();
      if (data.session?.user) return data.session.user.id;
      const { data: signed, error } = await client.auth.signInAnonymously();
      if (error || !signed.user) {
        sessionPromise = null;
        throw new Error(error?.message?.includes('Anonymous')
          ? 'Anonymous sign-ins are disabled in Supabase (Auth > Providers > Anonymous).'
          : error?.message ?? 'Could not start a guest session');
      }
      return signed.user.id;
    })();
  }
  return sessionPromise;
}
