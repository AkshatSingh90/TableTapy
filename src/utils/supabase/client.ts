import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://letangcabkdqhhjqbdyj.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxldGFuZ2NhYmtkcWhoanFiZHlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwNzk5MDQsImV4cCI6MjEwNTY1NTkwNH0.EwebCq_p8lPanvHbskSKOwyzi1b8EDMisft_fFFINcE'

export function createClient() {
  const isCustomDomain = typeof window !== 'undefined' && (
    window.location.hostname.endsWith('tabletapy.in') || 
    window.location.hostname.endsWith('tabletapy.online') || 
    window.location.hostname.endsWith('tabletapy.com')
  );
  const cookieOptions: Record<string, any> = {
    path: '/',
    sameSite: 'lax',
  };

  if (isCustomDomain) {
    const host = window.location.hostname;
    if (host.endsWith('tabletapy.in')) {
      cookieOptions.domain = '.tabletapy.in';
    } else if (host.endsWith('tabletapy.online')) {
      cookieOptions.domain = '.tabletapy.online';
    } else {
      cookieOptions.domain = '.tabletapy.com';
    }
  }

  return createBrowserClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookieOptions
    }
  )
}
