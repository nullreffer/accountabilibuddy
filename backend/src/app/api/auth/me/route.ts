import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { handleError, notFound, ok } from '@/lib/response';

export async function GET(req: NextRequest) {
  try {
    const userId = requireAuth(req);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return notFound('User not found');

    return ok({
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      photoUrl: user.photoUrl,
      createdAt: user.createdAt
    });
  } catch (err) {
    return handleError(err);
  }
}
