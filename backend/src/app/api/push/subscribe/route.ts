import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { badRequest, handleError, noContent, ok } from '@/lib/response';

// GET /api/push/subscribe — return VAPID public key
export async function GET() {
  return ok({ publicKey: process.env.VAPID_PUBLIC_KEY ?? null });
}

// POST /api/push/subscribe — save push subscription
export async function POST(req: NextRequest) {
  try {
    const userId = requireAuth(req);
    const body = (await req.json()) as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    };

    if (!body.endpoint || !body.keys?.p256dh || !body.keys.auth) {
      return badRequest('endpoint, keys.p256dh, and keys.auth are required');
    }

    await prisma.pushSubscription.upsert({
      where: { endpoint: body.endpoint },
      update: { p256dh: body.keys.p256dh, auth: body.keys.auth, userId },
      create: {
        userId,
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth
      }
    });

    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}

// DELETE /api/push/subscribe — remove push subscription
export async function DELETE(req: NextRequest) {
  try {
    const userId = requireAuth(req);
    const body = (await req.json()) as { endpoint?: string };

    if (!body.endpoint) return badRequest('endpoint is required');

    await prisma.pushSubscription.deleteMany({
      where: { endpoint: body.endpoint, userId }
    });

    return noContent();
  } catch (err) {
    return handleError(err);
  }
}
