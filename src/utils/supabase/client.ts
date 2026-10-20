import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const isCustomDomain = typeof window !== 'undefined' && window.location.hostname.endsWith('tabletapy.com');
  const cookieOptions: Record<string, any> = {
    path: '/',
    sameSite: 'lax',
  };

  // Only bind to .tabletapy.com if actually on that production domain; otherwise let the browser default to current host (vercel.app / localhost)
  if (isCustomDomain) {
    cookieOptions.domain = '.tabletapy.com';
  }

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions
    }
  )
}