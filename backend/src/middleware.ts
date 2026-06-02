import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_ORIGIN = process.env.FRONTEND_URL ?? 'http://localhost:5173';

export function middleware(req: NextRequest) {
  const origin = req.headers.get('origin') ?? '';

  const isAllowed =
    origin === ALLOWED_ORIGIN ||
    origin === 'http://localhost:5173' ||
    origin === 'http://localhost:3000';

  const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Credentials': 'true'
  };

  if (isAllowed) {
    corsHeaders['Access-Control-Allow-Origin'] = origin;
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
