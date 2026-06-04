import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { sendVerificationEmail } from '@/lib/email';
import { prisma } from '@/lib/prisma';
import { handleError, notFound, ok } from '@/lib/response';

// POST /api/auth/send-verification — resend verification code
export async function POST(req: NextRequest) {
  try {
    const userId = requireAuth(req);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return notFound('User not found');

    if (user.emailVerified) {
      return ok({ message: 'Email already verified' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.user.update({
      where: { id: userId },
      data: { verificationCode: code, verificationExpires: expires }
    });

    await sendVerificationEmail({ to: user.email, code, name: user.displayName });

    return ok({ message: 'Verification email sent' });
  } catch (err) {
    return handleError(err);
  }
}
