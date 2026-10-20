import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // SUBDOMAIN ROUTING LOGIC
  const hostname = request.headers.get('host') || '';
  const isLocalhost = hostname.includes('localhost');
  let subdomain = '';

  const isIpAddress = /^(d{1,3}.){3}d{1,3}$/.test(hostname.split(':')[0]);

  if (isLocalhost && !isIpAddress) {
    const parts = hostname.split(':');
    const domainParts = parts[0].split('.');
    if (domainParts.length > 1 && domainParts[0] !== 'localhost') {
      subdomain = domainParts[0];
    }
  } else {
    // For production (e.g., designer.tabletapy.com)
    const domainParts = hostname.replace('.tabletapy.com', '').split('.');
    if (domainParts.length === 1 && domainParts[0] !== 'tabletapy' && domainParts[0] !== 'www') {
      subdomain = domainParts[0];
    }
  }

  // 1. DEDICATED DESIGNER SUBDOMAIN (designer.tabletapy.com)
  if (subdomain === 'designer') {
    const rewriteResponse = NextResponse.rewrite(new URL(`/designer_app${request.nextUrl.pathname}`, request.url));
    response.cookies.getAll().forEach(cookie => rewriteResponse.cookies.set(cookie.name, cookie.value));
    return rewriteResponse;
  }

  // 2. DEDICATED ORDERS SUBDOMAIN (orders.tabletapy.com)
  if (subdomain === 'orders') {
    const rewriteResponse = NextResponse.rewrite(new URL(`/orders_app${request.nextUrl.pathname}`, request.url));
    response.cookies.getAll().forEach(cookie => rewriteResponse.cookies.set(cookie.name, cookie.value));
    return rewriteResponse;
  }

  // 3. DEDICATED CAPTAIN / WAITER SUBDOMAIN (captain.tabletapy.com)
  if (subdomain === 'captain') {
    const rewriteResponse = NextResponse.rewrite(new URL(`/captain${request.nextUrl.pathname}`, request.url));
    response.cookies.getAll().forEach(cookie => rewriteResponse.cookies.set(cookie.name, cookie.value));
    return rewriteResponse;
  }

  // 4. RESTAURANT PUBLIC MENU SUBDOMAIN (e.g., dailycafe.tabletapy.com)
  if (subdomain && subdomain !== 'www' && subdomain !== 'designer' && subdomain !== 'orders' && subdomain !== 'captain') {
    const rewriteResponse = NextResponse.rewrite(new URL(`/sites/${subdomain}${request.nextUrl.pathname}`, request.url));
    response.cookies.getAll().forEach(cookie => rewriteResponse.cookies.set(cookie.name, cookie.value));
    return rewriteResponse;
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
