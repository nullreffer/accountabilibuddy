import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ChatPanel from '../components/ChatPanel';
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
import { createCheckin, updateGroup, deleteGroup } from '../lib/api';
import { getAvatarFallback } from '../lib/avatar';

const tabs = ['chat', 'jar'] as const;
const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const timezones = ['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London'];

const todayKey = () => new Date().toISOString().split('T')[0];

const timerKey = (gid: string) => `ab_timer_start_${gid}`;

const formatDuration = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const TIMING_OPTIONS = [
  { value: '5min', label: '5 min before' },
  { value: '1hr',  label: '1 hr before' },
  { value: '1day', label: '1 day before' },
] as const;

interface NotifPrefs {
  email: boolean;
  push: boolean;
  emailTiming: string[];
  pushTiming: string[];
}
const defaultNotifPrefs = (): NotifPrefs => ({ email: false, push: true, emailTiming: ['1hr'], pushTiming: ['1hr'] });
const loadNotifPrefs = (gid: string, uid: string): NotifPrefs => {
  try {
    const raw = localStorage.getItem(`ab_notif_${gid}_${uid}`);
    if (raw) {
      const p = JSON.parse(raw) as Record<string, unknown>;
      // Migrate old single-timing format
      if ('timing' in p && !('emailTiming' in p)) {
        const t = (p.timing as string[]) ?? ['1hr'];
        return { email: Boolean(p.email), push: p.push !== false, emailTiming: t, pushTiming: t };
      }
      return p as unknown as NotifPrefs;
    }
  } catch { /* ignore */ }
  return defaultNotifPrefs();
};
const saveNotifPrefs = (gid: string, uid: string, prefs: NotifPrefs) =>
  localStorage.setItem(`ab_notif_${gid}_${uid}`, JSON.stringify(prefs));

const GroupPage = () => {
  const { groupId = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { group, member, loading, error } = useGroup(groupId);
  const { members } = useMembers(groupId);
  const { schedules, loading: schedulesLoading } = useSchedules(groupId);
  const { checkins, loading: checkinsLoading } = useCheckins(groupId, 50);
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>('chat');
  const [activeModal, setActiveModal] = useState<'members' | 'settings' | 'notifications' | 'chart' | 'schedules' | null>(null);

  // Check-in state
  const [checkinMode, setCheckinMode] = useState<'standard' | 'timer'>('standard');
  const [timerStartTime, setTimerStartTime] = useState<number | null>(() => {
    const stored = localStorage.getItem(timerKey(groupId));
    return stored ? parseInt(stored, 10) : null;
  });
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [selectedScheduleId, setSelectedScheduleId] = useState('manual');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [checkinLoading, setCheckinLoading] = useState(false);

  // Schedule form state
  const [scheduleFormOpen, setScheduleFormOpen] = useState(false);
  const [scheduleName, setScheduleName] = useState('');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'custom'>('daily');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [time, setTime] = useState('09:00');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');

  // Settings form state
  const [settingsName, setSettingsName] = useState('');
  const [settingsDescription, setSettingsDescription] = useState('');
  const [settingsJarEnabled, setSettingsJarEnabled] = useState(false);
  const [settingsJarAmount, setSettingsJarAmount] = useState('0');
  const [settingsPhotoProof, setSettingsPhotoProof] = useState(false);
  const [settingsCheckinType, setSettingsCheckinType] = useState<'standard' | 'timer'>('standard');
  const [settingsSaving, setSettingsSaving] = useState(false);

  // Notification prefs state
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>(defaultNotifPrefs);

  const canManage = member?.role === 'owner' || member?.role === 'coowner';
  const isOwner = member?.role === 'owner';
  const today = todayKey();

  const todaysCheckin = useMemo(
    () => checkins.find((checkin) => checkin.uid === user?.id && checkin.date === today && checkin.status === 'completed'),
    [checkins, today, user?.id]
  );

  // UIDs of all members who have completed a check-in today (for header avatars)
  const todayCheckinUids = useMemo(
    () => new Set(checkins.filter((c) => c.date === today && c.status === 'completed').map((c) => c.uid)),
    [checkins, today]
  );

  // Load notification prefs when user/group are available
  useEffect(() => {
    if (user && groupId) setNotifPrefs(loadNotifPrefs(groupId, user.id));
  }, [groupId, user]);

  // Timer interval – counts up using wall-clock diff so background doesn't matter
  useEffect(() => {
    if (!timerStartTime) { setElapsedSeconds(0); return; }
    const update = () => setElapsedSeconds(Math.floor((Date.now() - timerStartTime) / 1000));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [timerStartTime]);

  // If today's check-in is already done, clear any in-progress timer
  useEffect(() => {
    if (todaysCheckin && timerStartTime) {
      localStorage.removeItem(timerKey(groupId));
      setTimerStartTime(null);
      setCheckinMode('standard');
    }
  }, [todaysCheckin, timerStartTime, groupId]);

  useEffect(() => {
    if (group) {
      setSettingsName(group.name);
      setSettingsDescription(group.description);
      setSettingsJarEnabled(group.settings.jarEnabled);
      setSettingsJarAmount(String(group.settings.jarAmount));
      setSettingsPhotoProof(group.settings.photoProofRequired);
      setSettingsCheckinType(group.settings.checkinType ?? 'standard');
      if (schedules[0]) {
        setSelectedScheduleId((current) => (current === 'manual' ? schedules[0].id : current));
      }
    }
  }, [group, schedules]);

  const toggleDay = (day: number) => {
    setDaysOfWeek((current) => (current.includes(day) ? current.filter((item) => item !== day) : [...current, day].sort()));
  };

  const handleTimerStart = () => {
    const now = Date.now();
    localStorage.setItem(timerKey(groupId), String(now));
    setTimerStartTime(now);
  };

  const handleTimerCancel = () => {
    localStorage.removeItem(timerKey(groupId));
    setTimerStartTime(null);
    setCheckinMode('standard');
  };

  const handleCheckIn = async (durationSeconds?: number) => {
    if (!group || !user) return;

    if (group.settings.photoProofRequired && !photoFile) {
      window.alert('This group requires photo proof for check-ins.');
      return;
    }

    const scheduleId = selectedScheduleId === 'manual' ? schedules[0]?.id || 'manual' : selectedScheduleId;

    try {
      setCheckinLoading(true);
      await createCheckin(groupId, scheduleId, photoFile);
      setPhotoFile(null);
      if (durationSeconds !== undefined) {
        localStorage.removeItem(timerKey(groupId));
        setTimerStartTime(null);
        setCheckinMode('standard');
      }
    } catch (error) {
      console.error('Unable to check in', error);
      window.alert('Unable to save your check-in right now.');
    } finally {
      setCheckinLoading(false);
    }
  };

  const handleTimerDone = () => {
    if (!timerStartTime) return;
    void handleCheckIn(Math.floor((Date.now() - timerStartTime) / 1000));
  };

  const handleSaveNotifPrefs = (prefs: NotifPrefs) => {
    if (!user) return;
    setNotifPrefs(prefs);
    saveNotifPrefs(groupId, user.id, prefs);
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
      await updateGroup(group.id, {
        name: settingsName.trim(),
        description: settingsDescription.trim(),
        jarEnabled: settingsJarEnabled,
        jarAmount: settingsJarEnabled ? Number(settingsJarAmount) : 0,
        photoProofRequired: settingsPhotoProof,
        checkinType: settingsCheckinType
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
      await deleteGroup(group.id);
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

  // Derive check-in type from group settings
  const checkinType = group?.settings.checkinType ?? 'standard';

  // Build the check-in slot that lives beside the Send button in chat
  const checkinSlot = (() => {
    if (!group || !user) return null;
    if (todaysCheckin) {
      return <span className="status-pill status-pill--success checkin-slot-done">✅</span>;
    }
    if (checkinType === 'timer') {
      if (!timerStartTime) {
        return (
          <button className="button button--ghost button--small" onClick={handleTimerStart} title="Start timer check-in" type="button">
            ▶ Start
          </button>
        );
      }
      return (
        <>
          <span className="timer-display timer-display--sm">{formatDuration(elapsedSeconds)}</span>
          <button className="button button--secondary button--small" disabled={checkinLoading} onClick={() => void handleTimerDone()} type="button">
            {checkinLoading ? '…' : '✓ Done'}
          </button>
          <button className="button button--ghost button--small" onClick={handleTimerCancel} type="button" title="Cancel timer">✕</button>
        </>
      );
    }
    // standard
    return (
      <button className="button button--ghost button--small" disabled={checkinLoading} onClick={() => void handleCheckIn()} title="Check in" type="button">
        {checkinLoading ? '…' : '✓ Check In'}
      </button>
    );
  })();

  return (
    <div className="page page--wide stack-xl">
      <InstallPrompt />

      <section className="hero-card hero-card--compact">
        <div className="group-title-row">
          <button
            aria-label="Back to dashboard"
            className="back-glyph icon-btn"
            onClick={() => navigate('/dashboard')}
            title="Back to dashboard"
            type="button"
          >
            ←
          </button>
          <div>
            <h2 className="group-page-title">{group.name}</h2>
            {members.length > 0 ? (
              <div className="member-status-row">
                {members.map((m) => {
                  const checked = todayCheckinUids.has(m.uid);
                  return (
                    <div className="member-status-avatar" key={m.uid} title={`${m.displayName}${checked ? ' ✓' : ''}`}>
                      <img
                        alt={m.displayName}
                        className="avatar avatar--xs"
                        src={m.photoURL || getAvatarFallback(m.displayName || 'AB')}
                      />
                      {checked ? <span className="member-status-check" aria-hidden="true">✓</span> : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
        <div className="group-actions__icons">
          <button aria-label="Members" className="icon-btn" onClick={() => setActiveModal('members')} title="Members" type="button">
            👥
          </button>
          <button aria-label="Notifications" className="icon-btn" onClick={() => setActiveModal('notifications')} title="Notifications" type="button">
            🔔
          </button>
          <button aria-label="Schedules" className="icon-btn" onClick={() => setActiveModal('schedules')} title="Schedules" type="button">
            🕐
          </button>
          <button aria-label="Progress chart" className="icon-btn" onClick={() => setActiveModal('chart')} title="Progress chart" type="button">
            📊
          </button>
          {canManage ? (
            <button aria-label="Settings" className="icon-btn" onClick={() => setActiveModal('settings')} title="Settings" type="button">
              ⚙️
            </button>
          ) : null}
        </div>
      </section>

      {/* Only show tab strip when there is more than one visible tab (jar enabled) */}
      {group.settings.jarEnabled ? (
        <div className="tab-strip" role="tablist" aria-label="Group sections">
          {tabs.map((tab) => (
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
      ) : null}

      {(activeTab === 'chat' || !group.settings.jarEnabled) ? (
        <div className="chat-layout">
          <ChatPanel checkinSlot={checkinSlot} groupId={groupId} />
          <CheckinFeed groupId={groupId} />
        </div>
      ) : null}

      {activeTab === 'jar' && group.settings.jarEnabled ? <JarDisplay groupId={groupId} isOwner={isOwner} /> : null}

      {activeModal ? (
        <div aria-modal="true" className="modal-backdrop" onClick={() => setActiveModal(null)} role="dialog">
          <section className="modal-sheet card stack-lg" onClick={(event) => event.stopPropagation()}>
            <div className="card__header">
              <div>
                <p className="eyebrow">
                  {activeModal === 'members' ? 'Members'
                    : activeModal === 'settings' ? 'Settings'
                    : activeModal === 'notifications' ? 'Notifications'
                    : activeModal === 'schedules' ? 'Schedules'
                    : 'Progress'}
                </p>
                <h2>
                  {activeModal === 'members' ? 'Manage members'
                    : activeModal === 'settings' ? 'Group settings'
                    : activeModal === 'notifications' ? 'My notifications'
                    : activeModal === 'schedules' ? 'Reminder schedules'
                    : 'Group chart'}
                </h2>
              </div>
              <button aria-label="Close modal" className="icon-btn" onClick={() => setActiveModal(null)} type="button">
                ✕
              </button>
            </div>

            {activeModal === 'members' ? (
              <div className="stack-lg">
                <MemberList currentUserRole={member.role} groupId={groupId} />
                {canManage ? (
                  <section className="stack-md">
                    <div>
                      <p className="eyebrow">Invite</p>
                      <h3>Add members</h3>
                    </div>
                    <InviteManager groupId={groupId} isOwner={canManage} />
                  </section>
                ) : null}
              </div>
            ) : null}

            {activeModal === 'notifications' ? (
              <div className="stack-lg">
                <div className="stack-md">
                  <label className="switch-card">
                    <input
                      checked={notifPrefs.email}
                      onChange={(e) => handleSaveNotifPrefs({ ...notifPrefs, email: e.target.checked })}
                      type="checkbox"
                    />
                    <div>
                      <strong>Email notifications</strong>
                      <p>Get an email reminder when a schedule is due.</p>
                    </div>
                  </label>
                  {notifPrefs.email ? (
                    <div className="notif-timing-grid">
                      {TIMING_OPTIONS.map(({ value, label }) => {
                        const checked = notifPrefs.emailTiming.includes(value);
                        return (
                          <label className="checkbox-pill" key={value}>
                            <input
                              checked={checked}
                              onChange={() => {
                                const next = checked
                                  ? notifPrefs.emailTiming.filter((x) => x !== value)
                                  : [...notifPrefs.emailTiming, value];
                                handleSaveNotifPrefs({ ...notifPrefs, emailTiming: next });
                              }}
                              type="checkbox"
                            />
                            <span>{label}</span>
                          </label>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
                <div className="stack-md">
                  <label className="switch-card">
                    <input
                      checked={notifPrefs.push}
                      onChange={(e) => handleSaveNotifPrefs({ ...notifPrefs, push: e.target.checked })}
                      type="checkbox"
                    />
                    <div>
                      <strong>App notifications</strong>
                      <p>Receive push notifications on this device.</p>
                    </div>
                  </label>
                  {notifPrefs.push ? (
                    <div className="notif-timing-grid">
                      {TIMING_OPTIONS.map(({ value, label }) => {
                        const checked = notifPrefs.pushTiming.includes(value);
                        return (
                          <label className="checkbox-pill" key={value}>
                            <input
                              checked={checked}
                              onChange={() => {
                                const next = checked
                                  ? notifPrefs.pushTiming.filter((x) => x !== value)
                                  : [...notifPrefs.pushTiming, value];
                                handleSaveNotifPrefs({ ...notifPrefs, pushTiming: next });
                              }}
                              type="checkbox"
                            />
                            <span>{label}</span>
                          </label>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {activeModal === 'schedules' ? (
              <section className="stack-lg">
                <div className="card__header">
                  {canManage ? (
                    <button className="button button--secondary button--small" onClick={() => setScheduleFormOpen((c) => !c)} type="button">
                      {scheduleFormOpen ? 'Close' : 'Add Schedule'}
                    </button>
                  ) : null}
                </div>

                {scheduleFormOpen ? (
                  <form className="form-grid" onSubmit={(event) => void handleCreateSchedule(event)}>
                    <label className="field">
                      <span>Name</span>
                      <input className="input" onChange={(e) => setScheduleName(e.target.value)} value={scheduleName} />
                    </label>
                    <label className="field">
                      <span>Frequency</span>
                      <select className="input" onChange={(e) => setFrequency(e.target.value as 'daily' | 'weekly' | 'custom')} value={frequency}>
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
                      <input className="input" onChange={(e) => setTime(e.target.value)} type="time" value={time} />
                    </label>
                    <label className="field">
                      <span>Timezone</span>
                      <select className="input" onChange={(e) => setTimezone(e.target.value)} value={timezone}>
                        {timezones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
                      </select>
                    </label>
                    <button className="button button--primary" type="submit">Save Schedule</button>
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

            {activeModal === 'chart' ? <GroupHistoryChart groupId={groupId} /> : null}

            {activeModal === 'settings' ? (
              <section className="stack-lg">
                <form className="form-grid" onSubmit={(event) => void handleSaveSettings(event)}>
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
                  <label className="switch-card field--full">
                    <input
                      checked={settingsCheckinType === 'timer'}
                      onChange={(event) => setSettingsCheckinType(event.target.checked ? 'timer' : 'standard')}
                      type="checkbox"
                    />
                    <div>
                      <strong>Timer check-in</strong>
                      <p>Members start and stop a timer instead of a single tap check-in.</p>
                    </div>
                  </label>
                  <div className="form-actions field--full">
                    <button className="button button--primary" disabled={settingsSaving} type="submit">
                      {settingsSaving ? 'Saving...' : 'Save Settings'}
                    </button>
                  </div>
                </form>

                <section className="card danger-zone stack-md">
                  <div>
                    <p className="eyebrow">Danger zone</p>
                    <h2>Delete group</h2>
                    <p>This permanently removes the group and all its data.</p>
                  </div>
                  <button className="button button--danger" disabled={!isOwner} onClick={() => void handleDeleteGroup()}>
                    Delete Group
                  </button>
                </section>
              </section>
            ) : null}
          </section>
        </div>
      ) : null}
    </div>
  );
};

export default GroupPage;
