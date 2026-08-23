import { Hono } from 'hono';
import { requireArea } from '../auth/middleware.js';
import {
  storeUpload, listMedia, publishMedia, unpublishMedia, getPublicObject, UploadError,
} from '../media/repository.js';

/**
 * Admin media routes. Every route here requires the `media` permission —
 * mounted in worker/app.js AFTER `app.use('/api/admin/*', requireAuth)`, so
 * a caller reaches these handlers only with a verified identity already
 * attached. `requireArea('media')` on top of that is what actually gates
 * access; requireAuth alone lets an unregistered-but-verified email through
 * with user = null; see worker/auth/middleware.js.
 */
const media = new Hono();

media.use('*', requireArea('media'));

async function audit(db, actorEmail, action, detail) {
  await db.prepare(
    'INSERT INTO audit_log (actor_email, action, detail) VALUES (?, ?, ?)',
  ).bind(actorEmail, action, detail).run();
}

media.post('/', async (c) => {
  let form;
  try {
    form = await c.req.formData();
  } catch {
    return c.json({ error: 'Request body must be multipart/form-data' }, 400);
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return c.json({ error: 'A "file" field is required' }, 400);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  try {
    const row = await storeUpload(c.env, {
      bytes,
      filename: file.name,
      contentType: file.type,
      uploaderEmail: c.get('email'),
    });
    return c.json({ media: row }, 201);
  } catch (error) {
    if (error instanceof UploadError) {
      return c.json({ error: error.message }, error.status);
    }
    throw error;
  }
});

media.get('/', async (c) => {
  const [privateRows, publicRows] = await Promise.all([
    listMedia(c.env.DB, { status: 'private' }),
    listMedia(c.env.DB, { status: 'public' }),
  ]);
  return c.json({ media: [...publicRows, ...privateRows] });
});

media.post('/:key/publish', async (c) => {
  const key = c.req.param('key');
  const editorEmail = c.get('email');

  let row;
  try {
    row = await publishMedia(c.env, key, editorEmail);
  } catch (error) {
    if (error instanceof UploadError) {
      return c.json({ error: error.message }, error.status);
    }
    throw error;
  }

  await audit(c.env.DB, editorEmail, 'media.publish', key);

  return c.json({ media: row });
});

media.post('/:key/unpublish', async (c) => {
  const key = c.req.param('key');
  const editorEmail = c.get('email');

  const row = await unpublishMedia(c.env, key, editorEmail);

  await audit(c.env.DB, editorEmail, 'media.unpublish', key);

  return c.json({ media: row });
});

media.delete('/:key', async (c) => {
  const key = c.req.param('key');
  const actorEmail = c.get('email');

  await c.env.MEDIA.delete(`private/${key}`);
  await c.env.MEDIA.delete(`public/${key}`);
  await c.env.DB.prepare('DELETE FROM media WHERE key = ?').bind(key).run();

  await audit(c.env.DB, actorEmail, 'media.delete', key);

  return c.json({ ok: true });
});

export default media;

/**
 * The public media route. Deliberately mounted outside `/api/admin/*` (see
 * worker/app.js) so the public site can load images with no Access token
 * at all. Serves ONLY objects the `media` row marks `status = 'public'` —
 * getPublicObject() is the sole authority; see worker/media/repository.js.
 */
export const publicMedia = new Hono();

publicMedia.get('/:key', async (c) => {
  const key = c.req.param('key');

  const object = await getPublicObject(c.env, key);
  if (object === null) {
    return c.json({ error: 'Not found' }, 404, { 'cache-control': 'no-store' });
  }

  return new Response(object.body, {
    headers: {
      'content-type': object.httpMetadata?.contentType ?? 'application/octet-stream',
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
});
