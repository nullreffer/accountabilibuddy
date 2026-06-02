import {
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  collection,
  writeBatch,
  getDoc
} from 'firebase/firestore';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import CheckinFeed from '../components/CheckinFeed';
import GroupHistoryChart from '../components/GroupHistoryChart';
import InstallPrompt from '../components/InstallPrompt';
import InviteManager from '../components/InviteManager';
import JarDisplay from '../components/JarDisplay';
import LoadingSpinner from '../components/LoadingSpinner';
import MemberList from '../components/MemberList';
import ScheduleCard from '../components/ScheduleCard';
import { useAuth } from '../contexts/AuthContext';
import { useCheckins } from '../hooks/useCheckins';
import { useGroup } from '../hooks/useGroup';
import { useMembers } from '../hooks/useMembers';
import { createSchedule, deleteSchedule, useSchedules } from '../hooks/useSchedules';
import { db } from '../lib/firebase';
import { uploadCheckinPhoto } from '../lib/storage';

const tabs = ['overview', 'feed', 'chart', 'schedules', 'members', 'jar', 'invites', 'settings'] as const;
const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const timezones = ['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London'];

const todayKey = () => new Date().toISOString().split('T')[0];

const deleteGroupDeep = async (groupId: string) => {
  const collectionsToClear = ['members', 'schedules', 'checkins', 'invites', 'jars'];
  for (const collectionName of collectionsToClear) {
    const snapshot = await getDocs(collection(db, 'groups', groupId, collectionName));
    if (!snapshot.empty) {
      const batch = writeBatch(db);
      snapshot.docs.forEach((documentSnapshot) => batch.delete(documentSnapshot.ref));
      await batch.commit();
    }
  }
  await deleteDoc(doc(db, 'groups', groupId));
};

const GroupPage = () => {
  const { groupId = '' } = useParams();
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const { group, member, loading, error } = useGroup(groupId);
  const { members } = useMembers(groupId);
  const { schedules, loading: schedulesLoading } = useSchedules(groupId);
  const { checkins, loading: checkinsLoading } = useCheckins(groupId, 50);
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>('overview');
  const [selectedScheduleId, setSelectedScheduleId] = useState('manual');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [scheduleFormOpen, setScheduleFormOpen] = useState(false);
  const [scheduleName, setScheduleName] = useState('');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'custom'>('daily');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [time, setTime] = useState('09:00');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [settingsName, setSettingsName] = useState('');
  const [settingsDescription, setSettingsDescription] = useState('');
  const [settingsJarEnabled, setSettingsJarEnabled] = useState(false);
  const [settingsJarAmount, setSettingsJarAmount] = useState('0');
  const [settingsPhotoProof, setSettingsPhotoProof] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);

  const canManage = member?.role === 'owner' || member?.role === 'coowner';
  const isOwner = member?.role === 'owner';
  const today = todayKey();

  const todaysCheckin = useMemo(
    () => checkins.find((checkin) => checkin.uid === user?.uid && checkin.date === today && checkin.status === 'completed'),
    [checkins, today, user?.uid]
  );

  useEffect(() => {
    if (group) {
      setSettingsName(group.name);
      setSettingsDescription(group.description);
      setSettingsJarEnabled(group.settings.jarEnabled);
      setSettingsJarAmount(String(group.settings.jarAmount));
      setSettingsPhotoProof(group.settings.photoProofRequired);
      if (schedules[0]) {
        setSelectedScheduleId((current) => (current === 'manual' ? schedules[0].id : current));
      }
    }
  }, [group, schedules]);

  const toggleDay = (day: number) => {
    setDaysOfWeek((current) => (current.includes(day) ? current.filter((item) => item !== day) : [...current, day].sort()));
  };

  const handleCheckIn = async () => {
    if (!group || !user || !userProfile) {
      return;
    }

    if (group.settings.photoProofRequired && !photoFile) {
      window.alert('This group requires photo proof for check-ins.');
      return;
    }

    const scheduleId = selectedScheduleId === 'manual' ? schedules[0]?.id || 'manual' : selectedScheduleId;
    const checkinId = `${scheduleId}_${user.uid}_${today}`;

    try {
      setCheckinLoading(true);
      const existing = await getDoc(doc(db, 'groups', groupId, 'checkins', checkinId));
      if (existing.exists() && existing.data().status === 'completed') {
        window.alert('You already checked in for this schedule today.');
        return;
      }

      const photoURL = photoFile ? await uploadCheckinPhoto(groupId, checkinId, photoFile) : null;
      await setDoc(doc(db, 'groups', groupId, 'checkins', checkinId), {
        uid: user.uid,
        scheduleId,
        date: today,
        completedAt: new Date(),
        photoURL,
        status: 'completed',
        userDisplayName: userProfile.displayName,
        userPhotoURL: userProfile.photoURL
      });
      setPhotoFile(null);
    } catch (error) {
      console.error('Unable to check in', error);
      window.alert('Unable to save your check-in right now.');
    } finally {
      setCheckinLoading(false);
    }
  };

  const handleCreateSchedule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!scheduleName.trim()) {
      window.alert('Schedule name is required.');
      return;
    }

    if (frequency !== 'daily' && !daysOfWeek.length) {
      window.alert('Pick at least one day for weekly or custom schedules.');
      return;
    }

    try {
      await createSchedule(groupId, {
        name: scheduleName.trim(),
        frequency,
        daysOfWeek: frequency === 'daily' ? [] : daysOfWeek,
        time,
        timezone
      });
      setScheduleFormOpen(false);
      setScheduleName('');
      setFrequency('daily');
      setDaysOfWeek([]);
      setTime('09:00');
      setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
    } catch (error) {
      console.error('Unable to create schedule', error);
      window.alert('Unable to create the schedule right now.');
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    try {
      await deleteSchedule(groupId, scheduleId);
    } catch (error) {
      console.error('Unable to delete schedule', error);
      window.alert('Unable to delete the schedule right now.');
    }
  };

  const handleSaveSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!group) {
      return;
    }

    if (!settingsName.trim()) {
      window.alert('Group name is required.');
      return;
    }

    if (settingsJarEnabled && Number(settingsJarAmount) <= 0) {
      window.alert('Jar amount must be greater than 0.');
      return;
    }

    try {
      setSettingsSaving(true);
      await updateDoc(doc(db, 'groups', group.id), {
        name: settingsName.trim(),
        description: settingsDescription.trim(),
        settings: {
          jarEnabled: settingsJarEnabled,
          jarAmount: settingsJarEnabled ? Number(settingsJarAmount) : 0,
          photoProofRequired: settingsPhotoProof
        }
      });
    } catch (error) {
      console.error('Unable to save settings', error);
      window.alert('Unable to save settings right now.');
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!group || !window.confirm(`Delete ${group.name}? This cannot be undone.`)) {
      return;
    }

    try {
      await deleteGroupDeep(group.id);
      navigate('/dashboard');
    } catch (error) {
      console.error('Unable to delete group', error);
      window.alert('Unable to delete the group right now.');
    }
  };

  if (loading || checkinsLoading) {
    return <LoadingSpinner label="Loading group..." />;
  }

  if (error || !group || !member) {
    return (
      <div className="page page--narrow empty-state empty-state--centered">
        <h1>Group unavailable</h1>
        <p>{error || 'You do not have access to this group.'}</p>
      </div>
    );
  }

  return (
    <div className="page page--wide stack-xl">
      <InstallPrompt />
      <Link className="back-link" to="/dashboard">
        ← Back to dashboard
      </Link>

      <section className="hero-card hero-card--compact">
        <div>
          <p className="eyebrow">Group</p>
          <h1>{group.name}</h1>
          <p className="hero-card__text">{group.description || 'No description yet.'}</p>
        </div>
        <div className="hero-card__stats">
          <span className="badge badge--neutral">{members.length} members</span>
          <span className="badge badge--success">Your role: {member.role}</span>
        </div>
      </section>

      <div className="tab-strip" role="tablist" aria-label="Group sections">
        {tabs
          .filter((tab) => (tab === 'jar' ? group.settings.jarEnabled : true))
          .filter((tab) => (tab === 'settings' ? canManage : true))
          .map((tab) => (
            <button
              className={`tab-strip__button${activeTab === tab ? ' tab-strip__button--active' : ''}`}
              key={tab}
              onClick={() => setActiveTab(tab)}
              type="button"
            >
              {tab}
            </button>
          ))}
      </div>

      {activeTab === 'overview' ? (
        <section className="grid grid--two-thirds">
          <div className="card stack-lg">
            <div>
              <p className="eyebrow">Today</p>
              <h2>Ready to check in?</h2>
              <p>{todaysCheckin ? 'You already completed today\'s check-in. Great job.' : 'Keep your promise to the group.'}</p>
            </div>
            <div className="stack-md">
              {schedules.length > 1 ? (
                <label className="field">
                  <span>Schedule</span>
                  <select className="input" onChange={(event) => setSelectedScheduleId(event.target.value)} value={selectedScheduleId}>
                    {schedules.map((schedule) => (
                      <option key={schedule.id} value={schedule.id}>
                        {schedule.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {group.settings.photoProofRequired ? (
                <label className="field">
                  <span>Photo proof</span>
                  <input
                    accept="image/*"
                    className="input"
                    onChange={(event) => setPhotoFile(event.target.files?.[0] || null)}
                    type="file"
                  />
                </label>
              ) : null}
              <button
                className="button button--primary button--large"
                disabled={Boolean(todaysCheckin) || checkinLoading}
                onClick={() => void handleCheckIn()}
              >
                {checkinLoading ? 'Saving check-in...' : todaysCheckin ? 'Checked in today' : 'Check In'}
              </button>
            </div>
          </div>
          <div className="card stack-md">
            <div>
              <p className="eyebrow">Status</p>
              <h2>Your progress</h2>
            </div>
            <div className="stat-block">
              <span className={`status-pill ${todaysCheckin ? 'status-pill--success' : 'status-pill--warning'}`}>
                {todaysCheckin ? 'Completed today' : 'Awaiting check-in'}
              </span>
            </div>
            <div className="list-group">
              <div className="list-group__item">
                <div>
                  <p>Photo proof required</p>
                  <p className="helper-text">{group.settings.photoProofRequired ? 'Yes' : 'No'}</p>
                </div>
              </div>
              <div className="list-group__item">
                <div>
                  <p>Jar status</p>
                  <p className="helper-text">
                    {group.settings.jarEnabled ? `$${group.settings.jarAmount.toFixed(2)} per miss` : 'Disabled'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === 'feed' ? <CheckinFeed groupId={groupId} /> : null}
      {activeTab === 'chart' ? <GroupHistoryChart groupId={groupId} /> : null}

      {activeTab === 'schedules' ? (
        <section className="stack-lg">
          <div className="card card__header">
            <div>
              <p className="eyebrow">Schedules</p>
              <h2>Reminder cadence</h2>
            </div>
            {canManage ? (
              <button className="button button--secondary" onClick={() => setScheduleFormOpen((current) => !current)}>
                {scheduleFormOpen ? 'Close' : 'Add Schedule'}
              </button>
            ) : null}
          </div>

          {scheduleFormOpen ? (
            <form className="card form-grid" onSubmit={(event) => void handleCreateSchedule(event)}>
              <label className="field">
                <span>Name</span>
                <input className="input" onChange={(event) => setScheduleName(event.target.value)} value={scheduleName} />
              </label>
              <label className="field">
                <span>Frequency</span>
                <select className="input" onChange={(event) => setFrequency(event.target.value as 'daily' | 'weekly' | 'custom')} value={frequency}>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="custom">Custom</option>
                </select>
              </label>
              {(frequency === 'weekly' || frequency === 'custom') ? (
                <div className="field field--full">
                  <span>Days of week</span>
                  <div className="checkbox-grid">
                    {dayNames.map((label, index) => (
                      <label className="checkbox-pill" key={label}>
                        <input checked={daysOfWeek.includes(index)} onChange={() => toggleDay(index)} type="checkbox" />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
              <label className="field">
                <span>Time</span>
                <input className="input" onChange={(event) => setTime(event.target.value)} type="time" value={time} />
              </label>
              <label className="field">
                <span>Timezone</span>
                <select className="input" onChange={(event) => setTimezone(event.target.value)} value={timezone}>
                  {timezones.map((zone) => (
                    <option key={zone} value={zone}>
                      {zone}
                    </option>
                  ))}
                </select>
              </label>
              <button className="button button--primary" type="submit">
                Save Schedule
              </button>
            </form>
          ) : null}

          {schedulesLoading ? <LoadingSpinner label="Loading schedules..." /> : null}
          {schedules.length ? (
            <div className="stack-md">
              {schedules.map((schedule) => (
                <ScheduleCard
                  canEdit={canManage}
                  key={schedule.id}
                  onDelete={() => void handleDeleteSchedule(schedule.id)}
                  schedule={schedule}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">No schedules yet.</div>
          )}
        </section>
      ) : null}

      {activeTab === 'members' ? <MemberList currentUserRole={member.role} groupId={groupId} /> : null}
      {activeTab === 'jar' && group.settings.jarEnabled ? <JarDisplay groupId={groupId} isOwner={isOwner} /> : null}
      {activeTab === 'invites' ? <InviteManager groupId={groupId} isOwner={canManage} /> : null}

      {activeTab === 'settings' ? (
        <section className="stack-lg">
          <form className="card form-grid" onSubmit={(event) => void handleSaveSettings(event)}>
            <div className="field field--full">
              <p className="eyebrow">Settings</p>
              <h2>Adjust your group defaults</h2>
            </div>
            <label className="field">
              <span>Name</span>
              <input className="input" onChange={(event) => setSettingsName(event.target.value)} value={settingsName} />
            </label>
            <label className="field field--full">
              <span>Description</span>
              <textarea
                className="input input--textarea"
                onChange={(event) => setSettingsDescription(event.target.value)}
                rows={4}
                value={settingsDescription}
              />
            </label>
            <label className="switch-card field--full">
              <input
                checked={settingsJarEnabled}
                onChange={(event) => setSettingsJarEnabled(event.target.checked)}
                type="checkbox"
              />
              <div>
                <strong>Enable jar</strong>
                <p>Track missed check-ins with a per-miss amount.</p>
              </div>
            </label>
            {settingsJarEnabled ? (
              <label className="field">
                <span>Jar amount</span>
                <input
                  className="input"
                  min="0.01"
                  onChange={(event) => setSettingsJarAmount(event.target.value)}
                  step="0.01"
                  type="number"
                  value={settingsJarAmount}
                />
              </label>
            ) : null}
            <label className="switch-card field--full">
              <input
                checked={settingsPhotoProof}
                onChange={(event) => setSettingsPhotoProof(event.target.checked)}
                type="checkbox"
              />
              <div>
                <strong>Require photo proof</strong>
                <p>Add extra accountability by requiring image evidence.</p>
              </div>
            </label>
            <div className="form-actions field--full">
              <button className="button button--primary" disabled={settingsSaving} type="submit">
                {settingsSaving ? 'Saving...' : 'Save Settings'}
              </button>
              <Link className="button button--ghost" to={`/group/${groupId}/settings`}>
                Open full settings page
              </Link>
            </div>
          </form>

          <section className="card danger-zone stack-md">
            <div>
              <p className="eyebrow">Danger zone</p>
              <h2>Delete group</h2>
              <p>This permanently removes the group document and its subcollections.</p>
            </div>
            <button className="button button--danger" disabled={!isOwner} onClick={() => void handleDeleteGroup()}>
              Delete Group
            </button>
          </section>
        </section>
      ) : null}
    </div>
  );
};

export default GroupPage;
