/**
 * The visitor's path: applies published design overrides, and nothing else.
 *
 * `enabled={false}` means the editor can never be opened here — not by a
 * keystroke, not by `?vedit=1`. The provider is present only because it is
 * what applies overrides to the tree; without it, published edits would
 * render for their author in the editor and for nobody else.
 */
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { VeditProvider } from 'vedit';

/**
 * Fetch the published document for `pathname` from the public endpoint.
 *
 * Every failure answers null, which renders the page exactly as authored.
 * That is the correct degradation for a marketing site: a design override
 * is an enhancement, and losing one must never cost a visitor the page.
 */
function usePublishedDocument(pathname) {
  const [doc, setDoc] = useState(null);

  useEffect(() => {
    let active = true;

    // Reset on navigation so the previous route's overrides cannot paint
    // onto the new one during the fetch.
    setDoc(null);

    fetch(`/api/vedit?key=${encodeURIComponent(pathname)}`, {
      headers: { accept: 'application/json' },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (active) setDoc(body?.document ?? null);
      })
      .catch(() => {
        // Silent by design — see the function comment.
      });

    return () => { active = false; };
  }, [pathname]);

  return doc;
}

export default function VeditReader({ children }) {
  const { pathname } = useLocation();
  const doc = usePublishedDocument(pathname);

  return (
    <VeditProvider
      enabled={false}
      documentKey={pathname}
      initialDocument={doc}
    >
      {children}
    </VeditProvider>
  );
}
