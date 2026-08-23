import { useEffect, useState } from 'react';
import { listUsers, createUser, updateUser, deleteUser } from '../lib/api.js';

const AREAS = [
  { key: 'blog', label: 'Blog posts' },
  { key: 'media', label: 'Photos & videos' },
  { key: 'merch', label: 'Merch' },
  { key: 'campinfo', label: 'Camp info' },
];

const EMPTY_PERMISSIONS = {
  blog: false, media: false, merch: false, campinfo: false,
};

export default function Users({ currentEmail }) {
  const [users, setUsers] = useState([]);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const { users: list } = await listUsers();
    setUsers(list);
  }

  useEffect(() => { refresh().catch(setError); }, []);

  async function handleInvite(event) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await createUser({ email, name, permissions: EMPTY_PERMISSIONS });
      setEmail('');
      setName('');
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function togglePermission(user, area) {
    setError(null);
    const permissions = { ...user.permissions, [area]: !user.permissions[area] };
    try {
      await updateUser(user.email, { permissions });
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRemove(user) {
    setError(null);
    try {
      await deleteUser(user.email);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="admin-section" aria-labelledby="users-heading">
      <h2 id="users-heading">People</h2>
      <p className="admin-help">
        Adding someone here decides what they can edit. They also need to be
        added to Cloudflare Access before they can sign in at all.
      </p>

      {error && <p className="admin-error" role="alert">{error}</p>}

      <form className="admin-invite" onSubmit={handleInvite}>
        <label>
          Email
          <input
            type="email" required value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="person@example.com"
          />
        </label>
        <label>
          Name
          <input
            type="text" value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Optional"
          />
        </label>
        <button type="submit" disabled={busy}>Add person</button>
      </form>

      <table className="admin-table">
        <thead>
          <tr>
            <th scope="col">Person</th>
            {AREAS.map((area) => (
              <th scope="col" key={area.key}>{area.label}</th>
            ))}
            <th scope="col">Role</th>
            <th scope="col"><span className="visually-hidden">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.email}>
              <th scope="row">
                <span className="admin-person-name">
                  {user.name ?? user.email}
                </span>
                {user.name && (
                  <span className="admin-person-email">{user.email}</span>
                )}
              </th>
              {AREAS.map((area) => (
                <td key={area.key}>
                  <input
                    type="checkbox"
                    checked={user.isAdmin || user.permissions[area.key]}
                    disabled={user.isAdmin}
                    aria-label={`${area.label} for ${user.email}`}
                    onChange={() => togglePermission(user, area.key)}
                  />
                </td>
              ))}
              <td>{user.isAdmin ? 'Administrator' : 'Editor'}</td>
              <td>
                {user.email !== currentEmail && (
                  <button
                    type="button"
                    className="admin-remove"
                    onClick={() => handleRemove(user)}
                  >
                    Remove
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
