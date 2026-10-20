import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  const headerList = await headers()
  const host = headerList.get('host') || ''
  const isCustomDomain = host.includes('tabletapy.com')
  const domain = isCustomDomain ? '.tabletapy.com' : undefined

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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