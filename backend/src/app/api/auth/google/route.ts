import { OAuth2Client } from 'google-auth-library';
import { NextRequest } from 'next/server';
import { signToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { badRequest, handleError, ok } from '@/lib/response';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? '';

const oauthClient = new OAuth2Client(CLIENT_ID);

export async function POST(req: NextRequest) {
  try {
    const { idToken } = (await req.json()) as { idToken?: string };

    if (!idToken) {
      return badRequest('idToken is required');
    }

    const ticket = await oauthClient.verifyIdToken({ idToken, audience: CLIENT_ID });
    const payload = ticket.getPayload();

    if (!payload?.sub || !payload.email) {
      return badRequest('Invalid Google token');
    }

    const user = await prisma.user.upsert({
      where: { googleId: payload.sub },
      update: {
        displayName: payload.name ?? 'AccountabiliBuddy User',
        email: payload.email,
        photoUrl: payload.picture ?? null
      },
      create: {
        googleId: payload.sub,
        displayName: payload.name ?? 'AccountabiliBuddy User',
        email: payload.email,
        photoUrl: payload.picture ?? null
      }
    });

    const token = signToken({ sub: user.id, email: user.email });

    return ok({
      token,
      user: {
        id: user.id,
        displayName: user.displayName,
        email: user.email,
        photoUrl: user.photoUrl,
        createdAt: user.createdAt
      }
    });
  } catch (err) {
    return handleError(err);
  }
}
