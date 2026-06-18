import { OAuth2Client } from 'google-auth-library';
import { NextRequest } from 'next/server';
import { signToken } from '@/lib/auth';
import { sendVerificationEmail } from '@/lib/email';
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

    // Google verifies email addresses — trust the email_verified claim from the ID token
    const googleEmailVerified = payload.email_verified !== false;

    const user = await prisma.user.upsert({
      where: { googleId: payload.sub },
      update: {
        displayName: payload.name ?? 'AccountabiliBuddy User',
        email: payload.email,
        photoUrl: payload.picture ?? null,
        ...(googleEmailVerified && { emailVerified: true })
      },
      create: {
        googleId: payload.sub,
        displayName: payload.name ?? 'AccountabiliBuddy User',
        email: payload.email,
        photoUrl: payload.picture ?? null,
        emailVerified: googleEmailVerified
      }
    });

    // For unverified users, regenerate code and send email
    if (!user.emailVerified) {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expires = new Date(Date.now() + 15 * 60 * 1000);
      await prisma.user.update({
        where: { id: user.id },
        data: { verificationCode: code, verificationExpires: expires }
      });
      void sendVerificationEmail({ to: user.email, code, name: user.displayName }).catch((err) =>
        console.error('Failed to send verification email:', err)
      );
    }

    const token = signToken({ sub: user.id, email: user.email });

    return ok({
      token,
      user: {
        id: user.id,
        displayName: user.displayName,
        email: user.email,
        photoUrl: user.photoUrl,
        createdAt: user.createdAt,
        emailVerified: user.emailVerified
      }
    });
  } catch (err) {
    return handleError(err);
  }
}
