import { createClient } from '@supabase/supabase-js';

const url = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined;
const key = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !key) {
  console.warn('[Supabase] Credenciais ausentes — operando sem persistência remota.');
}

export const supabase = url && key
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        storageKey: 'spectrum-auth-token',
        storage: window.localStorage,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export const ALLOWED_DOMAINS = ['gocase.com', 'gogroup.com', 'gobeaute.com'];

export function isEmailAllowed(email: string): boolean {
  return ALLOWED_DOMAINS.some(domain => email.toLowerCase().endsWith(`@${domain}`));
}
