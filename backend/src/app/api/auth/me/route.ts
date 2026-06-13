import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { badRequest, handleError, notFound, ok } from '@/lib/response';

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
      createdAt: user.createdAt,
      emailVerified: user.emailVerified
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const userId = requireAuth(req);
    const body = (await req.json()) as { displayName?: string; photoUrl?: string };

    if (!body.displayName?.trim()) {
      return badRequest('displayName is required');
    }

    let normalizedPhotoUrl: string | null = null;
    if (body.photoUrl?.trim()) {
      try {
        const candidate = new URL(body.photoUrl.trim());
        if (!['http:', 'https:'].includes(candidate.protocol)) {
          return badRequest('photoUrl must use http or https');
        }
        normalizedPhotoUrl = candidate.toString();
      } catch {
        return badRequest('photoUrl must be a valid URL');
      }
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        displayName: body.displayName.trim(),
        photoUrl: normalizedPhotoUrl
      }
    });

    return ok({
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      photoUrl: user.photoUrl,
      createdAt: user.createdAt,
      emailVerified: user.emailVerified
    });
  } catch (err) {
    return handleError(err);
  }
}
