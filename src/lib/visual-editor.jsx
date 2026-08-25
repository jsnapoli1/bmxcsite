/**
 * vedit (https://github.com/jsnapoli1/vedit) wired in for local design work.
 *
 * Dev only, deliberately. `import.meta.env.DEV` is a compile-time constant, so
 * a production `vite build` folds this to `children` and drops the library from
 * the bundle — the site ships no editor code and no extra bytes. Edits are held
 * in localStorage; nothing is written to KV or D1. Making these edits real means
 * pointing the provider at an `httpAdapter` and gating it behind the same
 * Cloudflare Access check the admin panel uses.
 *
 * Press Cmd+E (Ctrl+E) on `npm run dev` to open it.
 */
import { lazy, Suspense } from 'react';

// Lazy so the library is fetched only when the dev server actually renders it,
// and so the bare `vedit` specifier never appears in a production module graph.
const VeditRoot = import.meta.env.DEV
  ? lazy(() => import('./visual-editor-dev.jsx'))
  : null;

/** Every route the editor offers as an artboard on its canvas. */
export const EDITABLE_PAGES = [
  { path: '/', label: 'Home' },
  { path: '/camp', label: 'Camp' },
  { path: '/playlists', label: 'Playlists' },
  { path: '/videos', label: 'Videos' },
  { path: '/merch', label: 'Merch' },
  { path: '/staff', label: 'Staff' },
  { path: '/faq', label: 'FAQ' },
  { path: '/blog', label: 'Blog' },
  { path: '/registration', label: 'Registration' },
  { path: '/contact', label: 'Contact' },
];

export default function VisualEditor({ children }) {
  if (!VeditRoot) return children;
  return (
    <Suspense fallback={children}>
      <VeditRoot>{children}</VeditRoot>
    </Suspense>
  );
}
