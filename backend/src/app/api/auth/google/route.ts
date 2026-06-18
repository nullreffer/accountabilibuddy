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
    if (!CLIENT_ID) {
      return badRequest('Google Sign In is not configured (GOOGLE_CLIENT_ID missing)');
    }

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

    let user = await prisma.user.findUnique({ where: { googleId: payload.sub } });

    if (user) {
      if (user.email !== payload.email) {
        const emailOwner = await prisma.user.findUnique({ where: { email: payload.email } });
        if (emailOwner && emailOwner.id !== user.id) {
          return badRequest('This Google email is already used by another account');
        }
      }

      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          displayName: payload.name ?? 'AccountabiliBuddy User',
          email: payload.email,
          photoUrl: payload.picture ?? null,
          emailVerified: googleEmailVerified
        }
      });
    } else {
      const existing = await prisma.user.findUnique({ where: { email: payload.email } });

      if (existing?.googleId && existing.googleId !== payload.sub) {
        return badRequest('This email is already linked to another Google account');
      }

      if (existing) {
        user = await prisma.user.update({
          where: { id: existing.id },
          data: {
            googleId: payload.sub,
            displayName: payload.name ?? existing.displayName,
            email: payload.email,
            photoUrl: payload.picture ?? existing.photoUrl,
            emailVerified: googleEmailVerified
          }
        });
      } else {
        user = await prisma.user.create({
          data: {
            googleId: payload.sub,
            displayName: payload.name ?? 'AccountabiliBuddy User',
            email: payload.email,
            photoUrl: payload.picture ?? null,
            emailVerified: googleEmailVerified
          }
        });
      }
    }

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
