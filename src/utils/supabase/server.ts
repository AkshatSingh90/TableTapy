import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://letangcabkdqhhjqbdyj.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxldGFuZ2NhYmtkcWhoanFiZHlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwNzk5MDQsImV4cCI6MjEwNTY1NTkwNH0.EwebCq_p8lPanvHbskSKOwyzi1b8EDMisft_fFFINcE'

export async function createClient() {
  const cookieStore = await cookies()
  const headerList = await headers()
  const host = headerList.get('host') || ''
  const isCustomDomain = host.includes('tabletapy.in') || host.includes('tabletapy.online') || host.includes('tabletapy.com')
  const domain = isCustomDomain 
    ? (host.includes('tabletapy.in') ? '.tabletapy.in' : (host.includes('tabletapy.online') ? '.tabletapy.online' : '.tabletapy.com'))
    : undefined

  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookieOptions: {
        ...(domain ? { domain } : {}),
        path: '/',
        sameSite: 'lax',
      },
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options, ...(domain ? { domain } : {}) })
          } catch (error) {
            // The `set` method was called from a Server Component.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options, ...(domain ? { domain } : {}) })
          } catch (error) {
            // The `delete` method was called from a Server Component.
          }
        },
      },
    }
  )
}