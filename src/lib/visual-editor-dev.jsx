/**
 * The half of the vedit integration that actually imports the library. Split
 * out from visual-editor.jsx so the bare `vedit` import sits behind a dynamic
 * import that only the dev branch reaches.
 */
import { VeditProvider } from 'vedit';
import { EDITABLE_PAGES } from './visual-editor.jsx';

export default function VeditRoot({ children }) {
  return (
    <VeditProvider pages={EDITABLE_PAGES}>
      {children}
    </VeditProvider>
  );
}
