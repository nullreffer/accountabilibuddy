import { collection, deleteDoc, doc, getDocs, updateDoc, writeBatch } from 'firebase/firestore';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import { useGroup } from '../hooks/useGroup';
import { db } from '../lib/firebase';

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

const GroupSettingsPage = () => {
  const { groupId = '' } = useParams();
  const navigate = useNavigate();
  const { group, member, loading } = useGroup(groupId);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [jarEnabled, setJarEnabled] = useState(false);
  const [jarAmount, setJarAmount] = useState('0');
  const [photoProofRequired, setPhotoProofRequired] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (group) {
      setName(group.name);
      setDescription(group.description);
      setJarEnabled(group.settings.jarEnabled);
      setJarAmount(String(group.settings.jarAmount));
      setPhotoProofRequired(group.settings.photoProofRequired);
    }
  }, [group]);

  if (loading) {
    return <LoadingSpinner label="Loading settings..." />;
  }

  if (!group || !member || (member.role !== 'owner' && member.role !== 'coowner')) {
    return (
      <div className="page page--narrow empty-state empty-state--centered">
        <h1>Settings unavailable</h1>
        <p>You do not have permission to manage this group.</p>
      </div>
    );
  }

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!name.trim()) {
      window.alert('Group name is required.');
      return;
    }

    if (jarEnabled && Number(jarAmount) <= 0) {
      window.alert('Jar amount must be greater than 0.');
      return;
    }

    try {
      setSaving(true);
      await updateDoc(doc(db, 'groups', groupId), {
        name: name.trim(),
        description: description.trim(),
        settings: {
          jarEnabled,
          jarAmount: jarEnabled ? Number(jarAmount) : 0,
          photoProofRequired
        }
      });
      navigate(`/group/${groupId}`);
    } catch (error) {
      console.error('Unable to save settings', error);
      window.alert('Unable to save group settings right now.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (member.role !== 'owner') {
      return;
    }

    const confirmed = window.confirm(`Delete ${group.name}? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    try {
      await deleteGroupDeep(groupId);
      navigate('/dashboard');
    } catch (error) {
      console.error('Unable to delete group', error);
      window.alert('Unable to delete the group right now.');
    }
  };

  return (
    <div className="page page--narrow stack-xl">
      <Link className="back-link" to={`/group/${groupId}`}>
        ← Back to group
      </Link>
      <form className="card form-grid" onSubmit={(event) => void handleSave(event)}>
        <div className="field field--full">
          <p className="eyebrow">Settings</p>
          <h1>Manage {group.name}</h1>
        </div>
        <label className="field">
          <span>Name</span>
          <input className="input" onChange={(event) => setName(event.target.value)} value={name} />
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
            <strong>Enable jar tracking</strong>
            <p>Charge a set amount for missed check-ins.</p>
          </div>
        </label>
        {jarEnabled ? (
          <label className="field">
            <span>Jar amount</span>
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
            <p>Collect a photo whenever someone checks in.</p>
          </div>
        </label>
        <div className="form-actions field--full">
          <button className="button button--primary" disabled={saving} type="submit">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>

      <section className="card danger-zone stack-md">
        <div>
          <p className="eyebrow">Danger zone</p>
          <h2>Delete group</h2>
          <p>Only the owner can permanently delete the group.</p>
        </div>
        <button className="button button--danger" disabled={member.role !== 'owner'} onClick={() => void handleDelete()}>
          Delete Group
        </button>
      </section>
    </div>
  );
};

export default GroupSettingsPage;
