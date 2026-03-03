import { NextResponse, type NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const response = NextResponse.next();

  // Derive Supabase host for CSP connect-src
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let supabaseHost = '*.supabase.co'; // fallback
  if (supabaseUrl) {
    try {
      supabaseHost = new URL(supabaseUrl).hostname;
    } catch {
      // keep fallback
    }
  }

  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",       // Tailwind v4 + Recharts need inline styles
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self' https://${supabaseHost} wss://${supabaseHost}`,
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
  ].join('; ');

  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  );

  // HSTS: only in production — avoids breaking local HTTP dev
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains'
    );
  }

  return response;
}

export const config = {
  matcher: '/(.*)',
};
