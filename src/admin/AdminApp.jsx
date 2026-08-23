import { useEffect, useState } from 'react';
import { getMe } from './lib/api.js';
import Users from './pages/Users.jsx';

export default function AdminApp() {
  const [me, setMe] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getMe().then(setMe).catch(setError);
  }, []);

  if (error) {
    return (
      <main className="admin-shell">
        <h1>Admin</h1>
        <p className="admin-notice">
          We could not confirm your access. Try reloading the page.
        </p>
      </main>
    );
  }

  if (!me) {
    return (
      <main className="admin-shell">
        <p className="admin-notice" aria-busy="true">Loading…</p>
      </main>
    );
  }

  if (!me.registered) {
    return (
      <main className="admin-shell">
        <h1>Admin</h1>
        <p className="admin-notice">
          You are signed in as <strong>{me.email}</strong>, but you have not
          been given access to anything yet. Ask a camp director to add you.
        </p>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <h1>Admin</h1>
        <p className="admin-identity">
          Signed in as {me.name ?? me.email}
          {me.isAdmin ? ' · Administrator' : ''}
        </p>
      </header>

      {me.isAdmin
        ? <Users currentEmail={me.email} />
        : <p className="admin-notice">
            Content editing arrives in the next phase.
          </p>}
    </main>
  );
}
