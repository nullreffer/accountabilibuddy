import { doc, setDoc } from 'firebase/firestore';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';

const CreateGroupPage = () => {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [jarEnabled, setJarEnabled] = useState(false);
  const [jarAmount, setJarAmount] = useState('5');
  const [photoProofRequired, setPhotoProofRequired] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user || !userProfile) {
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
      const groupRef = doc(db, 'groups', crypto.randomUUID());
      await setDoc(groupRef, {
        name: name.trim(),
        description: description.trim(),
        ownerId: user.uid,
        coOwnerIds: [],
        createdAt: new Date(),
        settings: {
          photoProofRequired,
          jarEnabled,
          jarAmount: jarEnabled ? Number(jarAmount) : 0
        }
      });

      await setDoc(doc(db, 'groups', groupRef.id, 'members', user.uid), {
        uid: user.uid,
        role: 'owner',
        notificationsEnabled: true,
        joinedAt: new Date(),
        displayName: userProfile.displayName,
        email: userProfile.email,
        photoURL: userProfile.photoURL
      });

      if (jarEnabled) {
        await setDoc(doc(db, 'groups', groupRef.id, 'jars', user.uid), {
          uid: user.uid,
          count: 0,
          totalOwed: 0,
          displayName: userProfile.displayName
        });
      }

      navigate(`/group/${groupRef.id}`);
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
