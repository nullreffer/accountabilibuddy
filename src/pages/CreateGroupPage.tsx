import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { createGroup } from '../lib/api';

const TEMPLATES = [
  { name: 'Gym Crew', description: 'Going to the gym — hold each other accountable for regular gym sessions.' },
  { name: 'Running Club', description: 'Running every week — stay consistent with your weekly running goals.' },
  { name: 'Daily Plank', description: 'Doing a plank every day — build core strength one plank at a time.' },
  { name: 'Home Chefs', description: 'Cooking once a week — make time to cook a home meal every week.' },
  { name: 'Plant Parents', description: 'Watering plants twice a week — keep your plants happy and thriving.' },
  { name: 'Family First', description: 'Checking in on parents once a week — stay connected with the people who matter.' },
  { name: 'Breathe & Flow', description: 'Breathing and yoga twice a week — prioritise mindfulness and flexibility.' },
  { name: 'Step Squad', description: 'Walking 5 miles a week — rack up steps and stay active together.' },
  { name: 'Book Club', description: 'Reading an hour everyday — build a daily reading habit, one page at a time.' }
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
