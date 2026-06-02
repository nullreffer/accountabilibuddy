import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import * as logger from 'firebase-functions/logger';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { defineString } from 'firebase-functions/params';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import sendgrid from '@sendgrid/mail';

initializeApp();

const db = getFirestore();
const messaging = getMessaging();
const sendgridApiKey = defineString('SENDGRID_API_KEY');

type GroupSettings = {
  photoProofRequired?: boolean;
  jarEnabled?: boolean;
  jarAmount?: number;
};

type GroupDoc = {
  name?: string;
  description?: string;
  ownerId?: string;
  coOwnerIds?: string[];
  createdAt?: Timestamp;
  settings?: GroupSettings;
};

type MemberDoc = {
  uid?: string;
  role?: 'owner' | 'coowner' | 'member';
  notificationsEnabled?: boolean;
  joinedAt?: Timestamp;
  displayName?: string;
  email?: string;
  photoURL?: string;
};

type CheckinDoc = {
  uid?: string;
  scheduleId?: string;
  date?: string;
  completedAt?: Timestamp;
  photoURL?: string | null;
  status?: 'completed' | 'missed';
  userDisplayName?: string;
  userPhotoURL?: string;
};

type ScheduleDoc = {
  name?: string;
  frequency?: 'daily' | 'weekly' | 'custom';
  daysOfWeek?: number[];
  time?: string;
  timezone?: string;
  createdAt?: Timestamp;
};

type UserDoc = {
  uid?: string;
  displayName?: string;
  email?: string;
  photoURL?: string;
  createdAt?: Timestamp;
  fcmTokens?: string[];
};

const scheduleWindowMinutes = 1;

const parseTime = (value?: string) => {
  const [hours, minutes] = (value || '09:00').split(':').map((part) => Number(part));
  return {
    hours: Number.isFinite(hours) ? hours : 9,
    minutes: Number.isFinite(minutes) ? minutes : 0
  };
};

const getLocalTimeParts = (date: Date, timezone = 'UTC') => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short'
  });

  const parts = formatter.formatToParts(date);
  const find = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || '';
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6
  };

  return {
    year: Number(find('year')),
    month: Number(find('month')),
    day: Number(find('day')),
    hour: Number(find('hour')),
    minute: Number(find('minute')),
    weekday: weekdayMap[find('weekday')] ?? date.getUTCDay(),
    dateKey: `${find('year')}-${find('month')}-${find('day')}`
  };
};

const isScheduleDue = (schedule: ScheduleDoc, now = new Date()) => {
  const timezone = schedule.timezone || 'UTC';
  const local = getLocalTimeParts(now, timezone);
  const target = parseTime(schedule.time);
  const minutesNow = local.hour * 60 + local.minute;
  const targetMinutes = target.hours * 60 + target.minutes;
  const minutesDelta = Math.abs(minutesNow - targetMinutes);

  if (minutesDelta > scheduleWindowMinutes) {
    return false;
  }

  if (schedule.frequency === 'weekly' || schedule.frequency === 'custom') {
    return Array.isArray(schedule.daysOfWeek) && schedule.daysOfWeek.includes(local.weekday);
  }

  return true;
};

const uniqueTokens = (users: UserDoc[]) =>
  Array.from(
    new Set(
      users.reduce<string[]>((allTokens, user) => {
        const nextTokens = Array.isArray(user.fcmTokens) ? user.fcmTokens.filter(Boolean) : [];
        return [...allTokens, ...nextTokens];
      }, [])
    )
  );

const getNotifiableMembers = async (groupId: string) => {
  const membersSnapshot = await db
    .collection('groups')
    .doc(groupId)
    .collection('members')
    .where('notificationsEnabled', '==', true)
    .get();

  const members = membersSnapshot.docs.map((memberSnapshot) => memberSnapshot.data() as MemberDoc);
  const userDocs = await Promise.all(
    members
      .map((member) => member.uid)
      .filter((uid): uid is string => Boolean(uid))
      .map((uid) => db.collection('users').doc(uid).get())
  );

  return {
    members,
    users: userDocs.filter((snapshot) => snapshot.exists).map((snapshot) => snapshot.data() as UserDoc)
  };
};

const sendNotificationToGroup = async (
  groupId: string,
  title: string,
  body: string,
  data: Record<string, string> = {}
) => {
  const { users } = await getNotifiableMembers(groupId);
  const tokens = uniqueTokens(users);

  if (!tokens.length) {
    return;
  }

  const response = await messaging.sendEachForMulticast({
    tokens,
    notification: { title, body },
    data
  });

  if (response.failureCount > 0) {
    logger.warn('Notification failures detected', {
      groupId,
      failureCount: response.failureCount
    });
  }
};

const shouldIncrementJarForSchedule = (schedule: ScheduleDoc, now = new Date()) => {
  if (!isScheduleDue(schedule, now)) {
    return false;
  }

  return now.getUTCMinutes() < 5;
};

const getGroupRefFromCollectionGroupDoc = <T>(snapshot: QueryDocumentSnapshot<T>) => snapshot.ref.parent.parent;

export const onCheckinCreated = onDocumentCreated('groups/{groupId}/checkins/{checkinId}', async (event) => {
  const snapshot = event.data;
  if (!snapshot) {
    return;
  }

  const groupId = event.params.groupId;
  const checkin = snapshot.data() as CheckinDoc;

  if (checkin.status !== 'completed') {
    return;
  }

  const groupSnapshot = await db.collection('groups').doc(groupId).get();
  const group = groupSnapshot.data() as GroupDoc | undefined;
  const groupName = group?.name || 'your group';
  const userDisplayName = checkin.userDisplayName || 'Someone';

  await sendNotificationToGroup(
    groupId,
    'Check-in completed',
    `${userDisplayName} completed their check-in in ${groupName}!`,
    {
      groupId,
      type: 'checkin'
    }
  );
});

export const processScheduleReminders = onSchedule('every 1 minutes', async () => {
  const schedulesSnapshot = await db.collectionGroup('schedules').get();
  const now = new Date();

  await Promise.all(
    schedulesSnapshot.docs.map(async (scheduleSnapshot) => {
      const schedule = scheduleSnapshot.data() as ScheduleDoc;
      const groupRef = getGroupRefFromCollectionGroupDoc(scheduleSnapshot);
      if (!groupRef || !isScheduleDue(schedule, now)) {
        return;
      }

      const groupSnapshot = await groupRef.get();
      const group = groupSnapshot.data() as GroupDoc | undefined;
      const groupName = group?.name || 'your group';

      await sendNotificationToGroup(
        groupRef.id,
        'Check-in reminder',
        `It's time for ${schedule.name || 'your scheduled'} check-in in ${groupName}.`,
        {
          groupId: groupRef.id,
          scheduleId: scheduleSnapshot.id,
          type: 'reminder'
        }
      );
    })
  );
});

export const processJarIncrement = onSchedule('every 60 minutes', async () => {
  const groupsSnapshot = await db.collection('groups').get();
  const now = new Date();

  await Promise.all(
    groupsSnapshot.docs.map(async (groupSnapshot) => {
      const group = groupSnapshot.data() as GroupDoc;
      if (!group.settings?.jarEnabled) {
        return;
      }

      const schedulesSnapshot = await groupSnapshot.ref.collection('schedules').get();
      const membersSnapshot = await groupSnapshot.ref.collection('members').get();
      const amount = Number(group.settings.jarAmount || 0);

      await Promise.all(
        schedulesSnapshot.docs.map(async (scheduleSnapshot) => {
          const schedule = scheduleSnapshot.data() as ScheduleDoc;
          if (!shouldIncrementJarForSchedule(schedule, now)) {
            return;
          }

          const local = getLocalTimeParts(now, schedule.timezone || 'UTC');
          const dateKey = local.dateKey;

          await Promise.all(
            membersSnapshot.docs.map(async (memberSnapshot) => {
              const member = memberSnapshot.data() as MemberDoc;
              const uid = member.uid || memberSnapshot.id;
              const checkinId = `${scheduleSnapshot.id}_${uid}_${dateKey}`;
              const checkinRef = groupSnapshot.ref.collection('checkins').doc(checkinId);
              const existingCheckin = await checkinRef.get();

              if (existingCheckin.exists) {
                return;
              }

              await checkinRef.set({
                uid,
                scheduleId: scheduleSnapshot.id,
                date: dateKey,
                completedAt: Timestamp.now(),
                photoURL: null,
                status: 'missed',
                userDisplayName: member.displayName || 'Member',
                userPhotoURL: member.photoURL || ''
              });

              await groupSnapshot.ref.collection('jars').doc(uid).set(
                {
                  uid,
                  displayName: member.displayName || 'Member',
                  count: FieldValue.increment(1),
                  totalOwed: FieldValue.increment(amount)
                },
                { merge: true }
              );
            })
          );
        })
      );
    })
  );
});

export const sendInviteEmail = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in to send invites.');
  }

  const { groupId, email, groupName, inviteUrl, inviterName } = request.data as {
    groupId?: string;
    email?: string;
    groupName?: string;
    inviteUrl?: string;
    inviterName?: string;
  };

  if (!groupId || !email || !groupName || !inviteUrl || !inviterName) {
    throw new HttpsError('invalid-argument', 'groupId, email, groupName, inviteUrl, and inviterName are required.');
  }

  sendgrid.setApiKey(sendgridApiKey.value());

  await sendgrid.send({
    to: email,
    from: {
      email: 'noreply@accountabilibuddy.app',
      name: 'Accountabilibuddy'
    },
    subject: `${inviterName} invited you to join ${groupName}`,
    text: `${inviterName} invited you to join ${groupName}. Join here: ${inviteUrl}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <h2>You're invited to Accountabilibuddy</h2>
        <p><strong>${inviterName}</strong> invited you to join <strong>${groupName}</strong>.</p>
        <p><a href="${inviteUrl}" style="display:inline-block;padding:12px 18px;background:#4f46e5;color:#ffffff;text-decoration:none;border-radius:999px;">Join the group</a></p>
        <p>If the button doesn't work, copy and paste this link into your browser:</p>
        <p>${inviteUrl}</p>
      </div>
    `
  });

  return { success: true };
});

export const cleanupStaleTokens = onSchedule('every 24 hours', async () => {
  const usersSnapshot = await db.collection('users').get();

  await Promise.all(
    usersSnapshot.docs.map(async (userSnapshot) => {
      const user = userSnapshot.data() as UserDoc;
      const tokens = Array.isArray(user.fcmTokens) ? user.fcmTokens.filter(Boolean) : [];

      if (!tokens.length) {
        return;
      }

      const response = await messaging.sendEachForMulticast(
        {
          tokens,
          notification: {
            title: 'Token validation',
            body: 'Validating notification tokens'
          }
        },
        true
      );

      const validTokens = tokens.filter((token, index) => {
        const sendResponse = response.responses[index];
        const errorCode = sendResponse.error?.code || '';
        return !errorCode.includes('registration-token-not-registered') && !errorCode.includes('invalid-registration-token');
      });

      if (validTokens.length !== tokens.length) {
        await userSnapshot.ref.update({
          fcmTokens: validTokens
        });
      }
    })
  );
});
