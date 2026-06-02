export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  createdAt: Date;
  fcmTokens: string[];
}

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
  coOwnerIds: string[];
  createdAt: Date;
  settings: GroupSettings;
}

export interface GroupMember {
  uid: string;
  role: 'owner' | 'coowner' | 'member';
  notificationsEnabled: boolean;
  joinedAt: Date;
  displayName: string;
  email: string;
  photoURL: string;
}

export interface Schedule {
  id: string;
  name: string;
  frequency: 'daily' | 'weekly' | 'custom';
  daysOfWeek: number[];
  time: string;
  timezone: string;
  createdAt: Date;
}

export interface Checkin {
  id: string;
  uid: string;
  scheduleId: string;
  date: string;
  completedAt: Date;
  photoURL: string | null;
  status: 'completed' | 'missed';
  userDisplayName: string;
  userPhotoURL: string;
}

export interface Invite {
  token: string;
  groupId: string;
  createdBy: string;
  email: string | null;
  createdAt: Date;
  expiresAt: Date;
  used: boolean;
}

export interface Jar {
  uid: string;
  count: number;
  totalOwed: number;
  displayName: string;
}
