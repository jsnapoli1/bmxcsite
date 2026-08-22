import { Hono } from 'hono';

const app = new Hono();

// Unknown API routes must answer JSON, not the SPA shell — otherwise a
// typo'd fetch resolves to HTML and fails somewhere far less obvious.
app.all('/api/*', (c) => c.json({ error: 'Not found' }, 404));

// Everything else is the existing static site, served by the assets binding.
app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
