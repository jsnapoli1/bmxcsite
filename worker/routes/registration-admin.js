/**
 * The admin view of registrations.
 *
 * Behind its own `registrations` permission rather than `campinfo`: this
 * is guardians' contact details and children's names, not site copy, and
 * whoever edits the FAQ has no reason to read it.
 *
 * Payment state is deliberately not writable here. Stripe and the webhook
 * own it — an admin marking a registration paid by hand would make the
 * database disagree with the money.
 */
import { Hono } from 'hono';
import { requireArea } from '../auth/middleware.js';
import { listRegistrations, cancelRegistration } from '../registration/repository.js';
import { toCsv } from '../email/subscribers.js';

const admin = new Hono();

admin.use('*', requireArea('registrations'));

async function audit(db, actorEmail, action, detail) {
  await db.prepare(
    'INSERT INTO audit_log (actor_email, action, detail) VALUES (?, ?, ?)',
  ).bind(actorEmail, action, detail).run();
}

const STATUSES = ['confirmed', 'draft', 'cancelled'];

admin.get('/', async (c) => {
  const requested = c.req.query('status') ?? 'confirmed';
  const status = STATUSES.includes(requested) ? requested : 'confirmed';
  return c.json({ registrations: await listRegistrations(c.env.DB, { status }) });
});

admin.get('/export.csv', async (c) => {
  const rows = await listRegistrations(c.env.DB, { status: 'confirmed' });

  // Reuses the formula guard from worker/email/subscribers.js rather than
  // writing a second one: a field starting = + - @ is executed on open by
  // Excel and Sheets, and this file exists to be opened in them.
  const csv = toCsv(rows, {
    columns: [
      'reference', 'camper_name', 'camper_dob', 'camper_grade',
      'guardian_name', 'guardian_email', 'guardian_phone',
      'emergency_name', 'emergency_phone',
      'bus_route', 'shirt_size', 'photo_consent',
      'tier', 'total_cents', 'deposit_paid_cents', 'balance_due_cents',
    ],
  });

  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="registrations.csv"',
    },
  });
});

admin.post('/:reference/cancel', async (c) => {
  const row = await cancelRegistration(c.env.DB, c.req.param('reference'));
  if (row === null) return c.json({ error: 'No such registration.' }, 404);

  await audit(c.env.DB, c.get('email'), 'registration.cancel', row.reference);
  return c.json({ registration: row });
});

export default admin;
