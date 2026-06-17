import { createPublicKey, type JsonWebKey } from 'crypto';
import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { signToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { badRequest, handleError, ok } from '@/lib/response';

// Apple's JWKS endpoint — keys rotate rarely, cache for 1 hour
const APPLE_JWKS_URL = 'https://appleid.cdn-apple.com/auth/keys';
const APPLE_ISSUER = 'https://appleid.apple.com';

let jwksCache: { keys: JsonWebKey[]; expiresAt: number } | null = null;

async function getApplePem(kid: string): Promise<string> {
  const now = Date.now();
  if (!jwksCache || now > jwksCache.expiresAt) {
    const res = await fetch(APPLE_JWKS_URL);
    const data = (await res.json()) as { keys: JsonWebKey[] };
    jwksCache = { keys: data.keys, expiresAt: now + 3_600_000 };
  }
  const jwk = jwksCache.keys.find((k) => k.kid === kid);
  if (!jwk) throw new Error('No matching Apple public key');
  const publicKey = createPublicKey({ key: jwk, format: 'jwk' });
  return publicKey.export({ type: 'spki', format: 'pem' }) as string;
}

interface AppleTokenPayload {
  iss: string;
  sub: string; // Apple user ID — stable across apps
  aud: string;
  email?: string;
  email_verified?: boolean | string;
  exp: number;
}

// POST /api/auth/apple
// Body: { idToken: string, displayName?: string, email?: string }
// Apple only sends user.name on the *first* sign-in — the frontend should pass it along.
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      idToken?: string;
      displayName?: string;
      email?: string;
    };

    if (!body.idToken) return badRequest('idToken is required');

    const clientId = process.env.APPLE_CLIENT_ID;
    if (!clientId) return badRequest('Apple Sign In is not configured (APPLE_CLIENT_ID missing)');

    // Decode header to get kid
    const [headerB64] = body.idToken.split('.');
    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString()) as { kid: string };
    const pem = await getApplePem(header.kid);

    const decoded = jwt.verify(body.idToken, pem, {
      algorithms: ['RS256'],
      issuer: APPLE_ISSUER,
      audience: clientId
    }) as AppleTokenPayload;

    if (!decoded.sub) return badRequest('Invalid Apple token: missing sub');

    const appleId = decoded.sub;
    // Apple may relay the email (privaterelay.appleid.com) or omit it on repeat sign-ins
    const email = body.email ?? decoded.email ?? `${appleId}@privaterelay.appleid.com`;
    const displayName = body.displayName ?? email.split('@')[0] ?? 'SquadGoals User';

    // Upsert: look for existing apple user first, then fall back to email match
    let user = await prisma.user.findUnique({ where: { appleId } });

    if (!user) {
      // Check if there's already an account with this email (e.g. from Google)
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        // Link the Apple ID to the existing account
        user = await prisma.user.update({ where: { id: existing.id }, data: { appleId } });
      } else {
        user = await prisma.user.create({
          data: { appleId, displayName, email, emailVerified: true }
        });
      }
    }

    const token = signToken({ sub: user.id, email: user.email });
    return ok({ token, user: { id: user.id, email: user.email, displayName: user.displayName } });
  } catch (err) {
    return handleError(err);
  }
}
