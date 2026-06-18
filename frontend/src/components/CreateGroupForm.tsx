import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { createGroup, createInvite, createSchedule } from '../lib/api';
import { formatTime12h } from '../lib/format';

type Frequency = 'daily' | 'weekly' | 'monthly' | 'custom';
type StepKey = 'template' | 'group' | 'schedule' | 'invite';

interface ScheduleDraft {
  name: string;
  frequency: Frequency;
  daysOfWeek: number[];
  time: string;
}

interface Template {
  emoji: string;
  name: string;
  description: string;
  schedules: ScheduleDraft[];
}

const TEMPLATES: Template[] = [
  {
    emoji: '🏋️',
    name: 'Gym Crew',
    description: 'Going to the gym — hold each other accountable for regular gym sessions.',
    schedules: [{ name: 'Gym Session', frequency: 'weekly', daysOfWeek: [1, 3, 5], time: '07:00' }]
  },
  {
    emoji: '🏃',
    name: 'Running Club',
    description: 'Running every week — stay consistent with your weekly running goals.',
    schedules: [{ name: 'Weekly Run', frequency: 'weekly', daysOfWeek: [6], time: '08:00' }]
  },
  {
    emoji: '🧱',
    name: 'Daily Plank',
    description: 'Doing a plank every day — build core strength one plank at a time.',
    schedules: [{ name: 'Daily Plank', frequency: 'daily', daysOfWeek: [], time: '07:00' }]
  },
  {
    emoji: '🍳',
    name: 'Home Chefs',
    description: 'Cooking once a week — make time to cook a home meal every week.',
    schedules: [{ name: 'Cook at Home', frequency: 'weekly', daysOfWeek: [0], time: '17:00' }]
  },
  {
    emoji: '🌿',
    name: 'Plant Parents',
    description: 'Watering plants twice a week — keep your plants happy and thriving.',
    schedules: [{ name: 'Water the Plants', frequency: 'weekly', daysOfWeek: [3, 6], time: '09:00' }]
  },
  {
    emoji: '❤️',
    name: 'Family First',
    description: 'Checking in on parents once a week — stay connected with the people who matter.',
    schedules: [{ name: 'Check In on Parents', frequency: 'weekly', daysOfWeek: [0], time: '11:00' }]
  },
  {
    emoji: '🧘',
    name: 'Breathe & Flow',
    description: 'Breathing and yoga twice a week — prioritise mindfulness and flexibility.',
    schedules: [{ name: 'Yoga & Breathing', frequency: 'weekly', daysOfWeek: [2, 5], time: '07:30' }]
  },
  {
    emoji: '👟',
    name: 'Step Squad',
    description: 'Walking 5 miles a week — rack up steps and stay active together.',
    schedules: [{ name: 'Weekly Walk', frequency: 'weekly', daysOfWeek: [6], time: '09:00' }]
  },
  {
    emoji: '📚',
    name: 'Book Club',
    description: 'Reading an hour every day — build a daily reading habit, one page at a time.',
    schedules: [{ name: 'Daily Reading', frequency: 'daily', daysOfWeek: [], time: '21:00' }]
  },
  {
    emoji: '🥾',
    name: 'Hiking Crew',
    description: 'Hitting the trails together — explore new routes and stay active outdoors.',
    schedules: [{ name: 'Weekly Hike', frequency: 'weekly', daysOfWeek: [6], time: '07:30' }]
  },
  {
    emoji: '📺',
    name: 'TV Gang',
    description: 'Watching episodes together every week — no spoilers until everyone\'s caught up.',
    schedules: [{ name: 'Watch Night', frequency: 'weekly', daysOfWeek: [5], time: '20:00' }]
  },
  {
    emoji: '🌅',
    name: 'Morning Routine',
    description: 'Starting every day with intention — build a consistent morning ritual together.',
    schedules: [{ name: 'Morning Check-In', frequency: 'daily', daysOfWeek: [], time: '07:00' }]
  }
];

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const NTH_LABELS = ['First', 'Second', 'Third', 'Fourth', 'Last'] as const;

const formatScheduleLabel = (schedule: ScheduleDraft) => {
  const t = formatTime12h(schedule.time);
  if (schedule.frequency === 'daily') return `${schedule.name} · Daily at ${t}`;
  if (schedule.frequency === 'monthly') {
    const day = schedule.daysOfWeek[0] ?? 1;
    if (day >= 100) {
      const offset = day - 100;
      const nth = Math.min(Math.floor(offset / 10), 4);
      const weekday = offset % 10;
      return `${schedule.name} · ${NTH_LABELS[nth]} ${DAY_LABELS[weekday] ?? ''} of each month at ${t}`;
    }
    const suffix = day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th';
    return `${schedule.name} · ${day}${suffix} of each month at ${t}`;
  }
  const days = schedule.daysOfWeek.map((day) => DAY_LABELS[day]).join(', ');
  return `${schedule.name} · ${days} at ${t}`;
};

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

interface CreateGroupFormProps {
  onCreated?: (groupId: string) => void;
  onCancel?: () => void;
  showBackLink?: boolean;
  submitLabel?: string;
}

const CreateGroupForm = ({
  onCreated,
  onCancel,
  showBackLink = false,
  submitLabel = 'Create group'
}: CreateGroupFormProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const templateRef = useRef<HTMLElement | null>(null);
  const groupRef = useRef<HTMLElement | null>(null);
  const scheduleRef = useRef<HTMLElement | null>(null);
  const inviteRef = useRef<HTMLElement | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [jarEnabled, setJarEnabled] = useState(false);
  const [jarAmount, setJarAmount] = useState('5');
  const [photoProofRequired, setPhotoProofRequired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [schedules, setSchedules] = useState<ScheduleDraft[]>([]);
  const [scheduleName, setScheduleName] = useState('');
  const [scheduleFrequency, setScheduleFrequency] = useState<Frequency>('weekly');
  const [scheduleDays, setScheduleDays] = useState<number[]>([]);
  const [scheduleTime, setScheduleTime] = useState('08:00');
  const [scheduleDayOfMonth, setScheduleDayOfMonth] = useState(1);
  const [monthlyMode, setMonthlyMode] = useState<'dayOfMonth' | 'nthWeekday'>('dayOfMonth');
  const [monthlyNth, setMonthlyNth] = useState(1);
  const [monthlyWeekday, setMonthlyWeekday] = useState(1);
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null);
  const [openStep, setOpenStep] = useState<StepKey | null>('template');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteEmails, setInviteEmails] = useState<string[]>([]);
  const [checkinType, setCheckinType] = useState<'standard' | 'timer'>('standard');

  const getStepRef = (step: StepKey) => {
    switch (step) {
      case 'template':
        return templateRef;
      case 'group':
        return groupRef;
      case 'schedule':
        return scheduleRef;
      case 'invite':
        return inviteRef;
    }
  };

  const openAndScrollToStep = (step: StepKey) => {
    setOpenStep(step);
    window.requestAnimationFrame(() => {
      getStepRef(step).current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const toggleStep = (step: StepKey) => {
    setOpenStep((current) => (current === step ? null : step));
  };

  const applyTemplate = (template: Template) => {
    setName(template.name);
    setDescription(template.description);
    setSchedules([...template.schedules]);
    setActiveTemplate(template.name);
    openAndScrollToStep('group');
  };

  const skipTemplateSelection = () => {
    setActiveTemplate(null);
    openAndScrollToStep('group');
  };

  const toggleDay = (day: number) => {
    setScheduleDays((previous) =>
      previous.includes(day) ? previous.filter((value) => value !== day) : [...previous, day]
    );
  };

  const addSchedule = () => {
    if (!scheduleName.trim()) {
      window.alert('Please enter a schedule name.');
      return;
    }

    if ((scheduleFrequency === 'weekly' || scheduleFrequency === 'custom') && scheduleDays.length === 0) {
      window.alert('Pick at least one day for weekly/custom schedules.');
      return;
    }

    let daysOfWeek: number[];
    if (scheduleFrequency === 'daily') {
      daysOfWeek = [];
    } else if (scheduleFrequency === 'monthly') {
      if (monthlyMode === 'nthWeekday') {
        daysOfWeek = [100 + (monthlyNth - 1) * 10 + monthlyWeekday];
      } else {
        daysOfWeek = [scheduleDayOfMonth];
      }
    } else {
      daysOfWeek = scheduleDays;
    }

    setSchedules((previous) => [
      ...previous,
      {
        name: scheduleName.trim(),
        frequency: scheduleFrequency,
        daysOfWeek,
        time: scheduleTime
      }
    ]);
    setScheduleName('');
    setScheduleDays([]);
    setScheduleTime('08:00');
    setScheduleFrequency('weekly');
    setScheduleDayOfMonth(1);
    setMonthlyMode('dayOfMonth');
    setMonthlyNth(1);
    setMonthlyWeekday(1);
  };

  const removeSchedule = (index: number) => {
    setSchedules((previous) => previous.filter((_, itemIndex) => itemIndex !== index));
  };

  const goToSchedules = () => {
    if (!name.trim()) {
      window.alert('Please provide a group name.');
      return;
    }

    if (jarEnabled && Number(jarAmount) <= 0) {
      window.alert('Jar amount must be greater than 0.');
      return;
    }

    openAndScrollToStep('schedule');
  };

  const addInviteEmailToList = () => {
    const email = inviteEmail.trim().toLowerCase();

    if (!email) {
      window.alert('Enter an email address first.');
      return;
    }

    if (!isValidEmail(email)) {
      window.alert('Please enter a valid email address.');
      return;
    }

    if (inviteEmails.includes(email)) {
      window.alert('That invite is already in the list.');
      return;
    }

    setInviteEmails((current) => [...current, email]);
    setInviteEmail('');
  };

  const removeInviteEmailFromList = (email: string) => {
    setInviteEmails((current) => current.filter((value) => value !== email));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    if (!name.trim()) {
      window.alert('Please provide a group name.');
      openAndScrollToStep('group');
      return;
    }
    if (jarEnabled && Number(jarAmount) <= 0) {
      window.alert('Jar amount must be greater than 0.');
      openAndScrollToStep('group');
      return;
    }

    // Auto-add a valid pending invite email before submitting
    let finalInviteEmails = inviteEmails;
    if (inviteEmail.trim()) {
      const pendingEmail = inviteEmail.trim().toLowerCase();
      if (!isValidEmail(pendingEmail)) {
        window.alert('The invite email field contains an invalid address. Please fix or clear it before creating the group.');
        return;
      }
      if (!finalInviteEmails.includes(pendingEmail)) {
        finalInviteEmails = [...finalInviteEmails, pendingEmail];
      }
    }

    try {
      setLoading(true);
      const group = await createGroup({
        name: name.trim(),
        description: description.trim(),
        photoProofRequired,
        jarEnabled,
        jarAmount: jarEnabled ? Number(jarAmount) : 0,
        checkinType
      });

      if (schedules.length > 0) {
        try {
          const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
          await Promise.all(schedules.map((schedule) => createSchedule(group.id, { ...schedule, timezone })));
        } catch (scheduleError) {
          console.error('Unable to save schedules for group', group.id, scheduleError);
          window.alert('Group created, but some schedules could not be saved. You can add them from the group settings.');
        }
      }

      if (finalInviteEmails.length > 0) {
        const inviteResults = await Promise.allSettled(
          finalInviteEmails.map((email) => createInvite(group.id, email, true))
        );
        const failedInviteCount = inviteResults.filter((result) => result.status === 'rejected').length;
        if (failedInviteCount > 0) {
          window.alert(
            `Your group was created, but ${failedInviteCount} invite${failedInviteCount === 1 ? '' : 's'} could not be sent.`
          );
        }
      }

      if (onCreated) {
        onCreated(group.id);
      } else {
        navigate(`/group/${group.id}`);
      }
    } catch (error) {
      console.error('Unable to create group', error);
      window.alert('Unable to create your group right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="stack-xl">
      {showBackLink ? (
        <Link className="back-link" to="/dashboard">
          ← Back to dashboard
        </Link>
      ) : null}
      {onCancel ? (
        <div className="step-card__actions">
          <button className="button button--ghost button--small" onClick={onCancel} type="button">
            Cancel
          </button>
        </div>
      ) : null}

      <form className="stack-xl" onSubmit={(event) => void handleSubmit(event)}>
        <section className={`card stack-lg step-card${openStep === 'template' ? '' : ' step-card--collapsed'}`} ref={templateRef}>
          <button
            aria-expanded={openStep === 'template'}
            className="step-card__toggle"
            onClick={() => toggleStep('template')}
            type="button"
          >
            <div>
              <p className="eyebrow">Step 1</p>
              <h2>Pick a template</h2>
              <p className="helper-text">Choose a starting point or skip and build your group from scratch.</p>
            </div>
            <span className="step-card__chevron">{openStep === 'template' ? '−' : '+'}</span>
          </button>

          {openStep === 'template' ? (
            <>
              <div className="template-grid">
                {TEMPLATES.map((template) => (
                  <button
                    key={template.name}
                    className={`template-card${activeTemplate === template.name ? ' template-card--active' : ''}`}
                    onClick={() => applyTemplate(template)}
                    type="button"
                  >
                    <span className="template-card__emoji">{template.emoji}</span>
                    {template.name}
                  </button>
                ))}
              </div>
              <div className="step-card__actions">
                <button className="button button--ghost" onClick={skipTemplateSelection} type="button">
                  Skip
                </button>
              </div>
            </>
          ) : null}
        </section>

        <section className={`card stack-lg step-card${openStep === 'group' ? '' : ' step-card--collapsed'}`} ref={groupRef}>
          <button
            aria-expanded={openStep === 'group'}
            className="step-card__toggle"
            onClick={() => toggleStep('group')}
            type="button"
          >
            <div>
              <p className="eyebrow">Step 2</p>
              <h2>Group info</h2>
              <p className="helper-text">Name your squad and set the accountability rules.</p>
            </div>
            <span className="step-card__chevron">{openStep === 'group' ? '−' : '+'}</span>
          </button>

          {openStep === 'group' ? (
            <>
              <div className="form-grid">
                <label className="field">
                  <span>Group name</span>
                  <input className="input" onChange={(event) => setName(event.target.value)} required value={name} />
                </label>
                <label className="field field--full">
                  <span>Description</span>
                  <textarea
                    className="input input--textarea"
                    onChange={(event) => setDescription(event.target.value)}
                    rows={3}
                    value={description}
                  />
                </label>
                <label className="switch-card field--full">
                  <input checked={jarEnabled} onChange={(event) => setJarEnabled(event.target.checked)} type="checkbox" />
                  <div>
                    <strong>Enable accountability jar</strong>
                    <p>Track missed check-ins and attach a dollar value.</p>
                  </div>
                </label>
                {jarEnabled ? (
                  <label className="field">
                    <span>$ per missed action</span>
                    <input
                      className="input"
                      min="0.01"
                      onChange={(event) => setJarAmount(event.target.value)}
                      step="0.01"
                      type="number"
                      value={jarAmount}
                    />
                  </label>
                ) : null}
                <label className="switch-card field--full">
                  <input
                    checked={photoProofRequired}
                    onChange={(event) => setPhotoProofRequired(event.target.checked)}
                    type="checkbox"
                  />
                  <div>
                    <strong>Require photo proof</strong>
                    <p>Members must attach a photo when checking in.</p>
                  </div>
                </label>
                <label className="switch-card field--full">
                  <input
                    checked={checkinType === 'timer'}
                    onChange={(event) => setCheckinType(event.target.checked ? 'timer' : 'standard')}
                    type="checkbox"
                  />
                  <div>
                    <strong>Timer check-in</strong>
                    <p>Members start and stop a timer instead of a single tap check-in.</p>
                  </div>
                </label>
              </div>
              <div className="step-card__actions">
                <button className="button button--secondary" onClick={goToSchedules} type="button">
                  Next
                </button>
              </div>
            </>
          ) : null}
        </section>

        <section className={`card stack-lg step-card${openStep === 'schedule' ? '' : ' step-card--collapsed'}`} ref={scheduleRef}>
          <button
            aria-expanded={openStep === 'schedule'}
            className="step-card__toggle"
            onClick={() => toggleStep('schedule')}
            type="button"
          >
            <div>
              <p className="eyebrow">Step 3</p>
              <h2>Schedules</h2>
              <p className="helper-text">Add the check-ins your squad should complete.</p>
            </div>
            <span className="step-card__chevron">{openStep === 'schedule' ? '−' : '+'}</span>
          </button>

          {openStep === 'schedule' ? (
            <>
              {schedules.length > 0 ? (
                <div className="schedule-draft-list">
                  {schedules.map((schedule, index) => (
                    <div className="schedule-draft-item" key={`${schedule.name}-${index}`}>
                      <div>
                        <strong>{schedule.name}</strong>
                        <p className="text-muted">{formatScheduleLabel(schedule)}</p>
                      </div>
                      <button
                        type="button"
                        className="button button--ghost button--small"
                        style={{ color: 'var(--danger)', flexShrink: 0 }}
                        onClick={() => removeSchedule(index)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">No schedules yet. You can add one now or continue and add them later.</div>
              )}

              <div className="form-grid" style={{ gap: '1rem' }}>
                <label className="field field--full">
                  <span>Schedule name</span>
                  <input
                    className="input"
                    placeholder="e.g. Morning Run"
                    value={scheduleName}
                    onChange={(event) => setScheduleName(event.target.value)}
                  />
                </label>

                <div className="form-row field--full">
                  <label className="field">
                    <span>Frequency</span>
                    <select
                      className="input"
                      value={scheduleFrequency}
                      onChange={(event) => {
                        setScheduleFrequency(event.target.value as Frequency);
                        setScheduleDays([]);
                      }}
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="custom">Custom days</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Time</span>
                    <input className="input" type="time" value={scheduleTime} onChange={(event) => setScheduleTime(event.target.value)} />
                  </label>
                </div>

                {scheduleFrequency === 'monthly' ? (
                  <div className="field field--full stack-md">
                    <div className="form-row">
                      <label className="field">
                        <span>Monthly type</span>
                        <select
                          className="input"
                          value={monthlyMode}
                          onChange={(event) => setMonthlyMode(event.target.value as 'dayOfMonth' | 'nthWeekday')}
                        >
                          <option value="dayOfMonth">Day of month (e.g. 1st)</option>
                          <option value="nthWeekday">Weekday (e.g. First Thursday)</option>
                        </select>
                      </label>
                    </div>
                    {monthlyMode === 'dayOfMonth' ? (
                      <label className="field">
                        <span>Day of month</span>
                        <input
                          className="input"
                          type="number"
                          min="1"
                          max="31"
                          value={scheduleDayOfMonth}
                          onChange={(event) => setScheduleDayOfMonth(Number(event.target.value))}
                        />
                        <span className="helper-text">Days 29–31 will be skipped in shorter months.</span>
                      </label>
                    ) : (
                      <div className="form-row">
                        <label className="field">
                          <span>Which</span>
                          <select className="input" value={monthlyNth} onChange={(e) => setMonthlyNth(Number(e.target.value))}>
                            <option value={1}>First</option>
                            <option value={2}>Second</option>
                            <option value={3}>Third</option>
                            <option value={4}>Fourth</option>
                            <option value={5}>Last</option>
                          </select>
                        </label>
                        <label className="field">
                          <span>Weekday</span>
                          <select className="input" value={monthlyWeekday} onChange={(e) => setMonthlyWeekday(Number(e.target.value))}>
                            {DAY_LABELS.map((label, index) => (
                              <option key={label} value={index}>{label}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                    )}
                  </div>
                ) : null}

                {(scheduleFrequency === 'weekly' || scheduleFrequency === 'custom') ? (
                  <div className="field field--full">
                    <span className="field__label">Days <span className="helper-text" style={{ fontWeight: 'normal' }}>(select one or more)</span></span>
                    <div className="day-picker">
                      {DAY_LABELS.map((label, day) => (
                        <button
                          key={label}
                          type="button"
                          className={`day-pill${scheduleDays.includes(day) ? ' day-pill--active' : ''}`}
                          onClick={() => toggleDay(day)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <button type="button" className="button button--secondary" onClick={addSchedule}>
                  + Add schedule
                </button>
              </div>

              <div className="step-card__actions">
                <button className="button button--secondary" onClick={() => openAndScrollToStep('invite')} type="button">
                  Next
                </button>
              </div>
            </>
          ) : null}
        </section>

        <section className={`card stack-lg step-card${openStep === 'invite' ? '' : ' step-card--collapsed'}`} ref={inviteRef}>
          <button
            aria-expanded={openStep === 'invite'}
            className="step-card__toggle"
            onClick={() => toggleStep('invite')}
            type="button"
          >
            <div>
              <p className="eyebrow">Step 4</p>
              <h2>Invite people</h2>
              <p className="helper-text">Optionally line up invite emails to send right after the group is created.</p>
            </div>
            <span className="step-card__chevron">{openStep === 'invite' ? '−' : '+'}</span>
          </button>

          {openStep === 'invite' ? (
            <>
              <div className="form-inline">
                <input
                  className="input"
                  onChange={(event) => setInviteEmail(event.target.value)}
                  placeholder="friend@example.com"
                  type="email"
                  value={inviteEmail}
                />
                <button className="button button--secondary" onClick={addInviteEmailToList} type="button">
                  Add invite
                </button>
              </div>

              {inviteEmails.length ? (
                <div className="invite-chip-list">
                  {inviteEmails.map((email) => (
                    <button
                      className="invite-chip"
                      key={email}
                      onClick={() => removeInviteEmailFromList(email)}
                      type="button"
                    >
                      {email} <span aria-hidden="true">✕</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="helper-text">No invites queued yet. You can skip this and invite people later.</p>
              )}

              <div className="step-card__actions">
                <button className="button button--primary" disabled={loading} type="submit">
                  {loading ? 'Creating group…' : inviteEmails.length ? `${submitLabel} & send invites` : submitLabel}
                </button>
              </div>
            </>
          ) : null}
        </section>
      </form>
    </div>
  );
};

export default CreateGroupForm;
