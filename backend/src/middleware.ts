import { NextRequest, NextResponse } from 'next/server';

const normalizeOrigin = (value: string) => value.trim().replace(/\/+$/, '');

const CONFIGURED_ORIGINS = (process.env.FRONTEND_URL ?? 'http://localhost:5173')
  .split(',')
  .map(normalizeOrigin)
  .filter(Boolean);

const ALLOWED_ORIGINS = new Set([
  ...CONFIGURED_ORIGINS,
  'http://localhost:5173',
  'http://localhost:3000'
]);

export function middleware(req: NextRequest) {
  const origin = req.headers.get('origin') ?? '';
  const normalizedOrigin = normalizeOrigin(origin);

  const isAllowed = normalizedOrigin ? ALLOWED_ORIGINS.has(normalizedOrigin) : false;

  const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Credentials': 'true'
  };

  if (isAllowed) {
    corsHeaders['Access-Control-Allow-Origin'] = origin;
  } else if (origin && req.nextUrl.pathname === '/api/auth/google') {
    console.warn('[cors] Blocked /api/auth/google request', {
      origin,
      allowedOrigins: Array.from(ALLOWED_ORIGINS)
    });
  }

  if (req.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: corsHeaders });
  }

  const response = NextResponse.next();
  for (const [key, value] of Object.entries(corsHeaders)) {
    response.headers.set(key, value);
  }
  return response;
}

export const config = {
  matcher: '/api/:path*'
};
