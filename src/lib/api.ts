const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

const TOKEN_KEY = 'ab_token';

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const setToken = (token: string) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

const headers = (extra: Record<string, string> = {}): Record<string, string> => {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: 'Bearer ' + token } : {}),
    ...extra
  };
};

const request = async <T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> => {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: headers(),
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new ApiError(res.status, (json as { error?: string }).error ?? 'Request failed');
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const uploadFormData = async <T>(path: string, formData: FormData): Promise<T> => {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: 'Bearer ' + token } : {},
    body: formData
  });

  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new ApiError(res.status, (json as { error?: string }).error ?? 'Upload failed');
  }
  return res.json() as Promise<T>;
};

// ---------- Auth ----------

export interface AuthUser {
  id: string;
  displayName: string;
  email: string;
  photoUrl: string | null;
  createdAt: string;
}

export const authGoogle = (idToken: string) =>
  request<{ token: string; user: AuthUser }>('POST', '/api/auth/google', { idToken });

export const authMe = () => request<AuthUser>('GET', '/api/auth/me');

// ---------- Groups ----------

export interface GroupSettings {
  photoProofRequired: boolean;
  jarEnabled: boolean;
  jarAmount: number;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  createdAt: string;
  settings: GroupSettings;
  memberCount?: number;
  role?: string;
}

export const fetchGroups = () => request<Group[]>('GET', '/api/groups');

export const fetchGroup = (id: string) => request<Group>('GET', `/api/groups/${id}`);

export const createGroup = (data: {
  name: string;
  description?: string;
  photoProofRequired?: boolean;
  jarEnabled?: boolean;
  jarAmount?: number;
}) => request<Group>('POST', '/api/groups', data);

export const updateGroup = (
  id: string,
  data: Partial<{
    name: string;
    description: string;
    photoProofRequired: boolean;
    jarEnabled: boolean;
    jarAmount: number;
  }>
) => request<Group>('PATCH', `/api/groups/${id}`, data);

export const deleteGroup = (id: string) => request<void>('DELETE', `/api/groups/${id}`);

// ---------- Members ----------

export interface GroupMember {
  uid: string;
  role: 'owner' | 'coowner' | 'member';
  notificationsEnabled: boolean;
  joinedAt: string;
  displayName: string;
  email: string;
  photoURL: string;
}

export const fetchMembers = (groupId: string) =>
  request<GroupMember[]>('GET', `/api/groups/${groupId}/members`);

export const updateMember = (
  groupId: string,
  uid: string,
  data: { role?: string; notificationsEnabled?: boolean }
) => request('PATCH', `/api/groups/${groupId}/members/${uid}`, data);

export const removeMember = (groupId: string, uid: string) =>
  request<void>('DELETE', `/api/groups/${groupId}/members/${uid}`);

// ---------- Schedules ----------

export interface Schedule {
  id: string;
  name: string;
  frequency: 'daily' | 'weekly' | 'custom';
  daysOfWeek: number[];
  time: string;
  timezone: string;
  createdAt: string;
}

export const fetchSchedules = (groupId: string) =>
  request<Schedule[]>('GET', `/api/groups/${groupId}/schedules`);

export const createSchedule = (
  groupId: string,
  data: Omit<Schedule, 'id' | 'createdAt'>
) => request<Schedule>('POST', `/api/groups/${groupId}/schedules`, data);

export const deleteSchedule = (groupId: string, scheduleId: string) =>
  request<void>('DELETE', `/api/groups/${groupId}/schedules/${scheduleId}`);

// ---------- Checkins ----------

export interface Checkin {
  id: string;
  uid: string;
  scheduleId: string;
  date: string;
  completedAt: string;
  photoURL: string | null;
  status: 'completed' | 'missed';
  userDisplayName: string;
  userPhotoURL: string;
}

export const fetchCheckins = (groupId: string, limit = 20) =>
  request<Checkin[]>('GET', `/api/groups/${groupId}/checkins?limit=${limit}`);

export const fetchAllCheckins = (groupId: string, dateRange: '7d' | '30d' | 'all') =>
  request<Checkin[]>('GET', `/api/groups/${groupId}/checkins?dateRange=${dateRange}`);

export const createCheckin = async (
  groupId: string,
  scheduleId: string,
  photoFile?: File | null
): Promise<Checkin> => {
  if (photoFile) {
    const formData = new FormData();
    formData.append('scheduleId', scheduleId);
    formData.append('photo', photoFile);
    return uploadFormData<Checkin>(`/api/groups/${groupId}/checkins`, formData);
  }
  return request<Checkin>('POST', `/api/groups/${groupId}/checkins`, { scheduleId });
};

// ---------- Invites ----------

export interface Invite {
  token: string;
  groupId: string;
  createdBy: string;
  email: string | null;
  createdAt: string;
  expiresAt: string;
  used: boolean;
  inviteUrl?: string;
}

export const fetchInvites = (groupId: string) =>
  request<Invite[]>('GET', `/api/groups/${groupId}/invites`);

export const createInvite = (groupId: string, email?: string | null, sendEmail?: boolean) =>
  request<Invite & { inviteUrl: string }>('POST', `/api/groups/${groupId}/invites`, {
    email: email ?? null,
    sendEmail: Boolean(sendEmail)
  });

export const revokeInvite = (groupId: string, token: string) =>
  request<void>('DELETE', `/api/groups/${groupId}/invites/${token}`);

export const fetchInviteByToken = (token: string) =>
  request<{ token: string; groupId: string; groupName: string; expiresAt: string }>(
    'GET',
    `/api/invites/${token}`
  );

export const joinByInvite = (token: string) =>
  request<{ groupId: string }>('POST', `/api/invites/${token}/join`);

// ---------- Jars ----------

export interface Jar {
  uid: string;
  count: number;
  totalOwed: number;
  displayName: string;
}

export const fetchJars = (groupId: string) =>
  request<Jar[]>('GET', `/api/groups/${groupId}/jars`);

export const resetJar = (groupId: string, uid: string) =>
  request('POST', `/api/groups/${groupId}/jars/${uid}/reset`);

export const updateJar = (groupId: string, uid: string, data: { count?: number; totalOwed?: number }) =>
  request<{ uid: string; count: number; totalOwed: number }>('PATCH', `/api/groups/${groupId}/jars/${uid}`, data);

// ---------- Push ----------

export const fetchVapidKey = () =>
  request<{ publicKey: string | null }>('GET', '/api/push/subscribe');

export const savePushSubscription = (sub: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}) => request('POST', '/api/push/subscribe', sub);

export const deletePushSubscription = (endpoint: string) =>
  request('DELETE', '/api/push/subscribe', { endpoint });
