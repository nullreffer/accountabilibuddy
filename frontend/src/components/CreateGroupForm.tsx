import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { createGroup, createSchedule } from '../lib/api';

type Frequency = 'daily' | 'weekly' | 'monthly';

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
  }
];

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_DAY_LABELS = Array.from({ length: 31 }, (_, index) => index + 1);

const formatScheduleLabel = (schedule: ScheduleDraft) => {
  if (schedule.frequency === 'daily') return `${schedule.name} · Daily at ${schedule.time}`;
  if (schedule.frequency === 'monthly') {
    const days = schedule.daysOfWeek.join(', ');
    return `${schedule.name} · Monthly on day ${days} at ${schedule.time}`;
  }
  const days = schedule.daysOfWeek.map((day) => DAY_LABELS[day]).join(', ');
  return `${schedule.name} · ${days} at ${schedule.time}`;
};

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
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null);

  const applyTemplate = (template: Template) => {
    setName(template.name);
    setDescription(template.description);
    setSchedules([...template.schedules]);
    setActiveTemplate(template.name);
  };

  const toggleDay = (day: number) => {
    setScheduleDays((previous) =>
      previous.includes(day) ? previous.filter((value) => value !== day) : [...previous, day].sort((a, b) => a - b)
    );
  };

  const addSchedule = () => {
    if (!scheduleName.trim()) {
      window.alert('Please enter a schedule name.');
      return;
    }

    if ((scheduleFrequency === 'weekly' || scheduleFrequency === 'monthly') && scheduleDays.length === 0) {
      window.alert(`Pick at least one ${scheduleFrequency === 'monthly' ? 'day of month' : 'day of week'}.`);
      return;
    }

    setSchedules((previous) => [
      ...previous,
      {
        name: scheduleName.trim(),
        frequency: scheduleFrequency,
        daysOfWeek: scheduleFrequency === 'daily' ? [] : scheduleDays,
        time: scheduleTime
      }
    ]);
    setScheduleName('');
    setScheduleDays([]);
    setScheduleTime('08:00');
    setScheduleFrequency('weekly');
  };

  const removeSchedule = (index: number) => {
    setSchedules((previous) => previous.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    if (!name.trim()) {
      window.alert('Please provide a group name.');
      return;
    }
    if (jarEnabled && Number(jarAmount) <= 0) {
      window.alert('Jar amount must be greater than 0.');
      return;
    }

    try {
      setLoading(true);
      const group = await createGroup({
        name: name.trim(),
        description: description.trim(),
        photoProofRequired,
        jarEnabled,
        jarAmount: jarEnabled ? Number(jarAmount) : 0
      });

      if (schedules.length > 0) {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        await Promise.all(schedules.map((schedule) => createSchedule(group.id, { ...schedule, timezone })));
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

      <section className="card stack-lg">
        <div>
          <p className="eyebrow">Quick start</p>
          <h2>Pick a template</h2>
          <p className="helper-text">Choose a template to pre-fill the group details and schedules, or fill in the form yourself.</p>
        </div>
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
      </section>

      <section className="card stack-lg">
        <div className="card__header card__header--stack-sm">
          <div>
            <p className="eyebrow">Create a group</p>
            <h1>Start a new accountability circle</h1>
          </div>
          {onCancel ? (
            <button className="button button--ghost button--small" onClick={onCancel} type="button">
              Cancel
            </button>
          ) : null}
        </div>
        <form id="create-group-form" className="form-grid" onSubmit={(event) => void handleSubmit(event)}>
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
        </form>
      </section>

      <section className="card stack-lg">
        <div>
          <p className="eyebrow">Schedules</p>
          <h2>Add check-in schedules</h2>
          <p className="helper-text">Define when members should check in. You can add more after creating the group.</p>
        </div>

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
        ) : null}

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
              </select>
            </label>
            <label className="field">
              <span>Time</span>
              <input className="input" type="time" value={scheduleTime} onChange={(event) => setScheduleTime(event.target.value)} />
            </label>
          </div>

          {scheduleFrequency === 'weekly' || scheduleFrequency === 'monthly' ? (
            <div className="field field--full">
              <span className="field__label">
                {scheduleFrequency === 'monthly' ? 'Days of month' : 'Days of week'}
              </span>
              <div className="day-picker">
                {(scheduleFrequency === 'monthly' ? MONTH_DAY_LABELS : DAY_LABELS).map((label, day) => (
                  <button
                    key={label}
                    type="button"
                    className={`day-pill${scheduleDays.includes(scheduleFrequency === 'monthly' ? day + 1 : day) ? ' day-pill--active' : ''}`}
                    onClick={() => toggleDay(scheduleFrequency === 'monthly' ? day + 1 : day)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="helper-text">Select one or more days.</p>
            </div>
          ) : null}

          <button type="button" className="button button--secondary" onClick={addSchedule}>
            + Add schedule
          </button>
        </div>
      </section>

      <button className="button button--primary" disabled={loading} form="create-group-form" type="submit">
        {loading ? 'Creating group…' : submitLabel}
      </button>
    </div>
  );
};

export default CreateGroupForm;
