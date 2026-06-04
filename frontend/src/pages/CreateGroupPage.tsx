import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { createGroup, createSchedule } from '../lib/api';

type Frequency = 'daily' | 'weekly' | 'custom';

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

const formatScheduleLabel = (s: ScheduleDraft) => {
  if (s.frequency === 'daily') return `${s.name} · Daily at ${s.time}`;
  const days = s.daysOfWeek.map((d) => DAY_LABELS[d]).join(', ');
  return `${s.name} · ${days} at ${s.time}`;
};

const CreateGroupPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Group fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [jarEnabled, setJarEnabled] = useState(false);
  const [jarAmount, setJarAmount] = useState('5');
  const [photoProofRequired, setPhotoProofRequired] = useState(false);
  const [loading, setLoading] = useState(false);

  // Schedule builder
  const [schedules, setSchedules] = useState<ScheduleDraft[]>([]);
  const [schName, setSchName] = useState('');
  const [schFreq, setSchFreq] = useState<Frequency>('weekly');
  const [schDays, setSchDays] = useState<number[]>([]);
  const [schTime, setSchTime] = useState('08:00');

  const [activeTemplate, setActiveTemplate] = useState<string | null>(null);

  const applyTemplate = (template: Template) => {
    setName(template.name);
    setDescription(template.description);
    setSchedules([...template.schedules]);
    setActiveTemplate(template.name);
  };

  const toggleDay = (day: number) => {
    setSchDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const addSchedule = () => {
    if (!schName.trim()) { window.alert('Please enter a schedule name.'); return; }
    if (schFreq === 'weekly' && schDays.length === 0) { window.alert('Pick at least one day for weekly schedules.'); return; }
    setSchedules((prev) => [
      ...prev,
      { name: schName.trim(), frequency: schFreq, daysOfWeek: schFreq === 'daily' ? [] : schDays, time: schTime }
    ]);
    setSchName('');
    setSchDays([]);
    setSchTime('08:00');
    setSchFreq('weekly');
  };

  const removeSchedule = (idx: number) => {
    setSchedules((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    if (!name.trim()) { window.alert('Please provide a group name.'); return; }
    if (jarEnabled && Number(jarAmount) <= 0) { window.alert('Jar amount must be greater than 0.'); return; }

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
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        await Promise.all(
          schedules.map((s) =>
            createSchedule(group.id, { ...s, timezone: tz })
          )
        );
      }

      navigate(`/group/${group.id}`);
    } catch (error) {
      console.error('Unable to create group', error);
      window.alert('Unable to create your group right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page page--narrow stack-xl">
      <Link className="back-link" to="/dashboard">
        ← Back to dashboard
      </Link>

      {/* Template picker */}
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

      {/* Group details form */}
      <section className="card stack-lg">
        <div>
          <p className="eyebrow">Create a group</p>
          <h1>Start a new accountability circle</h1>
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
          {jarEnabled && (
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
          )}
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

      {/* Schedule builder */}
      <section className="card stack-lg">
        <div>
          <p className="eyebrow">Schedules</p>
          <h2>Add check-in schedules</h2>
          <p className="helper-text">Define when members should check in. You can add more after creating the group.</p>
        </div>

        {schedules.length > 0 && (
          <div className="schedule-draft-list">
            {schedules.map((s, idx) => (
              <div className="schedule-draft-item" key={idx}>
                <div>
                  <strong>{s.name}</strong>
                  <p className="text-muted">{formatScheduleLabel(s)}</p>
                </div>
                <button
                  type="button"
                  className="button button--ghost button--small"
                  style={{ color: 'var(--danger)', flexShrink: 0 }}
                  onClick={() => removeSchedule(idx)}
                  aria-label={`Remove ${s.name}`}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="form-grid" style={{ gap: '1rem' }}>
          <label className="field field--full">
            <span>Schedule name</span>
            <input
              className="input"
              placeholder="e.g. Morning Run"
              value={schName}
              onChange={(e) => setSchName(e.target.value)}
            />
          </label>

          <div className="form-row">
            <label className="field">
              <span>Frequency</span>
              <select className="input" value={schFreq} onChange={(e) => { setSchFreq(e.target.value as Frequency); setSchDays([]); }}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </label>
            <label className="field">
              <span>Time</span>
              <input className="input" type="time" value={schTime} onChange={(e) => setSchTime(e.target.value)} />
            </label>
          </div>

          {schFreq === 'weekly' && (
            <div className="field field--full">
              <span className="field__label">Days</span>
              <div className="day-picker">
                {DAY_LABELS.map((label, day) => (
                  <button
                    key={day}
                    type="button"
                    className={`day-pill${schDays.includes(day) ? ' day-pill--active' : ''}`}
                    onClick={() => toggleDay(day)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button type="button" className="button button--secondary" onClick={addSchedule}>
            + Add schedule
          </button>
        </div>
      </section>

      <button className="button button--primary" disabled={loading} form="create-group-form" type="submit">
        {loading ? 'Creating group…' : 'Create group'}
      </button>
    </div>
  );
};

export default CreateGroupPage;


const TEMPLATES = [
  { name: 'Gym Crew', description: 'Going to the gym — hold each other accountable for regular gym sessions.' },
  { name: 'Running Club', description: 'Running every week — stay consistent with your weekly running goals.' },
  { name: 'Daily Plank', description: 'Doing a plank every day — build core strength one plank at a time.' },
  { name: 'Home Chefs', description: 'Cooking once a week — make time to cook a home meal every week.' },
  { name: 'Plant Parents', description: 'Watering plants twice a week — keep your plants happy and thriving.' },
  { name: 'Family First', description: 'Checking in on parents once a week — stay connected with the people who matter.' },
  { name: 'Breathe & Flow', description: 'Breathing and yoga twice a week — prioritise mindfulness and flexibility.' },
  { name: 'Step Squad', description: 'Walking 5 miles a week — rack up steps and stay active together.' },
  { name: 'Book Club', description: 'Reading an hour every day — build a daily reading habit, one page at a time.' }
] as const;

const CreateGroupPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [jarEnabled, setJarEnabled] = useState(false);
  const [jarAmount, setJarAmount] = useState('5');
  const [photoProofRequired, setPhotoProofRequired] = useState(false);
  const [loading, setLoading] = useState(false);

  const applyTemplate = (template: (typeof TEMPLATES)[number]) => {
    setName(template.name);
    setDescription(template.description);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user) {
      return;
    }

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
      navigate(`/group/${group.id}`);
    } catch (error) {
      console.error('Unable to create group', error);
      window.alert('Unable to create your group right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page page--narrow stack-xl">
      <Link className="back-link" to="/dashboard">
        ← Back to dashboard
      </Link>
      <section className="card stack-lg">
        <div>
          <p className="eyebrow">Quick start</p>
          <h2>Pick a template</h2>
          <p className="helper-text">Choose a template to pre-fill the form, or fill it in yourself below.</p>
        </div>
        <div className="checkbox-grid">
          {TEMPLATES.map((template) => (
            <button
              className="button button--secondary button--small"
              key={template.name}
              onClick={() => applyTemplate(template)}
              type="button"
            >
              {template.name}
            </button>
          ))}
        </div>
      </section>
      <section className="card stack-lg">
        <div>
          <p className="eyebrow">Create a group</p>
          <h1>Start a new accountability circle</h1>
        </div>
        <form className="form-grid" onSubmit={(event) => void handleSubmit(event)}>
          <label className="field">
            <span>Group name</span>
            <input className="input" onChange={(event) => setName(event.target.value)} required value={name} />
          </label>
          <label className="field field--full">
            <span>Description</span>
            <textarea
              className="input input--textarea"
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
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
          <button className="button button--primary" disabled={loading} type="submit">
            {loading ? 'Creating group...' : 'Create Group'}
          </button>
        </form>
      </section>
    </div>
  );
};

export default CreateGroupPage;
