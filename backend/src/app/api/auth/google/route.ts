import { OAuth2Client } from 'google-auth-library';
import { Prisma } from '@prisma/client';
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

    const googleSub = payload.sub;
    const googleEmail = payload.email;

    // Google verifies email addresses — trust the email_verified claim from the ID token
    const googleEmailVerified = payload.email_verified !== false;

    const user = await prisma.$transaction(async (tx) => {
      const existingByGoogle = await tx.user.findUnique({ where: { googleId: googleSub } });

      if (existingByGoogle) {
        if (existingByGoogle.email !== googleEmail) {
          const emailOwner = await tx.user.findUnique({ where: { email: googleEmail } });
          if (emailOwner && emailOwner.id !== existingByGoogle.id) {
            throw new Error('GOOGLE_EMAIL_IN_USE');
          }
        }

        return tx.user.update({
          where: { id: existingByGoogle.id },
          data: {
            displayName: payload.name ?? 'AccountabiliBuddy User',
            email: googleEmail,
            photoUrl: payload.picture ?? null,
            emailVerified: googleEmailVerified
          }
        });
      }

      const existingByEmail = await tx.user.findUnique({ where: { email: googleEmail } });

      if (existingByEmail?.googleId && existingByEmail.googleId !== googleSub) {
        throw new Error('GOOGLE_ID_CONFLICT');
      }

      if (existingByEmail) {
        return tx.user.update({
          where: { id: existingByEmail.id },
          data: {
            googleId: googleSub,
            displayName: payload.name ?? existingByEmail.displayName,
            email: googleEmail,
            photoUrl: payload.picture ?? existingByEmail.photoUrl,
            emailVerified: googleEmailVerified
          }
        });
      }

      return tx.user.create({
        data: {
          googleId: googleSub,
          displayName: payload.name ?? 'AccountabiliBuddy User',
          email: googleEmail,
          photoUrl: payload.picture ?? null,
          emailVerified: googleEmailVerified
        }
      });
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
    if (err instanceof Error) {
      if (err.message === 'GOOGLE_EMAIL_IN_USE') {
        return badRequest('This Google email is already used by another account');
      }
      if (err.message === 'GOOGLE_ID_CONFLICT') {
        return badRequest('This email is already linked to another Google account');
      }
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return badRequest('Account already exists with conflicting sign-in credentials');
    }
    return handleError(err);
  }
}
