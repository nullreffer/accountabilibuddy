import webpush from 'web-push';
import { prisma } from './prisma';

let initialized = false;

const init = () => {
  if (initialized) return;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const email = process.env.VAPID_EMAIL ?? 'mailto:noreply@accountabilibuddy.app';

  if (!publicKey || !privateKey) {
    console.warn('VAPID keys not configured – push notifications disabled');
    return;
  }

  webpush.setVapidDetails(email, publicKey, privateKey);
  initialized = true;
};

export const sendPushToGroup = async (
  groupId: string,
  title: string,
  body: string,
  data: Record<string, string> = {}
) => {
  init();
  if (!initialized) return;

  const members = await prisma.groupMember.findMany({
    where: { groupId, notificationsEnabled: true },
    include: {
      user: {
        include: { pushSubscriptions: true }
      }
    }
  });

  const payload = JSON.stringify({ title, body, data });

  await Promise.allSettled(
    members.flatMap((member) =>
      member.user.pushSubscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          );
        } catch (err: unknown) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await prisma.pushSubscription.delete({ where: { endpoint: sub.endpoint } }).catch(() => undefined);
          }
        }
      })
    )
  );
};

export const sendPushToUser = async (userId: string, title: string, body: string) => {
  init();
  if (!initialized) return;

  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
  const payload = JSON.stringify({ title, body });

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await prisma.pushSubscription.delete({ where: { endpoint: sub.endpoint } }).catch(() => undefined);
        }
      }
    })
  );
};
