import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { badRequest, handleError, notFound, ok } from '@/lib/response';

// POST /api/auth/verify-email — verify code and mark email as verified
export async function POST(req: NextRequest) {
  try {
    const userId = requireAuth(req);
    const { code } = (await req.json()) as { code?: string };

    if (!code) return badRequest('code is required');

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return notFound('User not found');

    if (user.emailVerified) {
      return ok({ verified: true });
    }

    if (
      user.verificationCode !== code ||
      !user.verificationExpires ||
      user.verificationExpires < new Date()
    ) {
      return badRequest('Invalid or expired verification code');
    }

    await prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true, verificationCode: null, verificationExpires: null }
    });

    return ok({ verified: true });
  } catch (err) {
    return handleError(err);
  }
}
