import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const isLocalhost = typeof window !== 'undefined' && window.location.hostname.includes('localhost');
  const domain = isLocalhost ? 'localhost' : '.tabletapy.com';

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        domain: domain,
        path: '/',
        sameSite: 'lax',
      }
    }
  )
}