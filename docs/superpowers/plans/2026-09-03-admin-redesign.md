# Admin panel redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/admin` responsive and give it shared form, table and state primitives, without changing any behaviour.

**Architecture:** `admin.css` is split into four files imported by `main.jsx`, so a rule is found by what it styles rather than by scrolling 600 lines. The nav becomes a sidebar on desktop and a drawer under 48rem. Tables gain a stacked card mode at narrow widths using `data-label` attributes, so no table markup is duplicated. Three new shared components replace the busy/empty/error markup each page currently reinvents.

**Tech Stack:** React 19, plain CSS with custom properties from `src/styles/tokens.css`, Vitest, Vite.

**Spec:** `docs/superpowers/specs/2026-09-03-admin-panel-design.md` (section 1)

## Global Constraints

Copied from the spec and CLAUDE.md. These apply to every task.

- **Field Guide direction.** Serif display (`--font-display`), warm paper surfaces, **no shadows**, radii 2-6px, structure from rules and weight.
- **Banned, do not reintroduce:** uppercase headings, gradient-filled text, decorative gradients, animated stripes, hover lifts, pill buttons.
- **Palette is tokens only.** Use `var(--color-*)` from `src/styles/tokens.css`. Do not introduce new hex values. The one exception already in the file is `#fff` on solid navy/green fills, which has a comment explaining the missing on-primary token — preserve that comment when moving those rules.
- **No behaviour changes.** This phase is visual and structural. No API call changes, no permission changes, no copy rewrites.
- **Every HTML entry point needs a `must-revalidate` rule in `public/_headers`.** Do not remove the existing `/admin` and `/admin.html` rules.
- **Verify in a browser.** Per CLAUDE.md, a passing build is not evidence. Task 7 is the browser pass and is not optional.

---

### Task 1: Split `admin.css` into four files

Pure move. No rule changes, so anything that looks different afterwards is a mistake.

**Files:**
- Create: `src/admin/styles/shell.css`, `src/admin/styles/controls.css`, `src/admin/styles/tables.css`, `src/admin/styles/pages.css`
- Modify: `src/admin/main.jsx`
- Delete: `src/admin/admin.css`

**Interfaces:**
- Consumes: nothing.
- Produces: four stylesheets imported by `main.jsx` in the order shell → controls → tables → pages. Later tasks add rules to the file matching their subject.

- [ ] **Step 1: Move the rules**

Cut each block from `src/admin/admin.css` into the file named below. Copy rules **verbatim**, including comments.

| Destination | Rules to move |
|---|---|
| `shell.css` | `.admin-shell`, `.admin-header`, `.admin-shell h1`, `.admin-identity`, `.admin-section h2`, `.admin-help`, `.admin-notice`, `.admin-error`, `.admin-status`, `.visually-hidden`, the `/* --- Navigation --- */` block |
| `controls.css` | `.admin-invite`, `.admin-invite label`, `.admin-invite input`, `.admin-invite button`, `.admin-remove`, `.admin-draft-state`, `.admin-actions`, `.admin-save`, `.admin-publish`, the `/* --- Shared field styling --- */` block, `.admin-subheading`, `.admin-add`, `.admin-linklike`, `.admin-upload` and its children |
| `tables.css` | `.admin-table` and all its descendants, `.admin-person-name`, `.admin-person-email` |
| `pages.css` | the `/* --- Reorder controls --- */` block, `.staff-group`/`.faq-category`/`.merch-item`/`.merch-fact` and their descendants, `.campinfo-fields`, the `/* --- Media library --- */` block from `.media-group` down, `.blog-status` |

Keep the file header comment from `admin.css` at the top of `shell.css`.

- [ ] **Step 2: Update the import**

In `src/admin/main.jsx`, replace `import './admin.css';` with:

```jsx
import './styles/shell.css';
import './styles/controls.css';
import './styles/tables.css';
import './styles/pages.css';
```

- [ ] **Step 3: Delete the old file and confirm nothing else imports it**

```bash
rm src/admin/admin.css
grep -rn "admin.css" src/ test/ *.html *.js 2>/dev/null
```

Expected: no results.

- [ ] **Step 4: Build**

```bash
npm run build
```

Expected: succeeds.

- [ ] **Step 5: Commit**

```bash
git add -A src/admin
git commit -m "refactor: split admin.css by subject"
```

---

### Task 2: Responsive shell and sidebar navigation

**Files:**
- Modify: `src/admin/AdminApp.jsx`, `src/admin/styles/shell.css`

**Interfaces:**
- Consumes: `navItems` (array of `{ id, label }`) and `selected` (string) as already computed in `AdminApp.jsx`.
- Produces: the `.admin-layout` grid wrapper and `.admin-nav` markup. Task 5 renders inside `.admin-main`.

- [ ] **Step 1: Restructure the shell markup**

In `src/admin/AdminApp.jsx`, replace the final `return (...)` block (currently lines 103-141) with:

```jsx
  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div className="admin-header__bar">
          <h1>Admin</h1>
          {navItems.length > 1 && (
            <button
              type="button"
              className="admin-nav__toggle"
              aria-expanded={navOpen}
              aria-controls="admin-nav"
              onClick={() => setNavOpen((open) => !open)}
            >
              {navOpen ? 'Close' : 'Sections'}
            </button>
          )}
        </div>
        <p className="admin-identity">
          Signed in as {me.name ?? me.email}
          {me.isAdmin ? ' · Administrator' : ''}
        </p>
      </header>

      <div className="admin-layout">
        {navItems.length > 1 && (
          <nav
            id="admin-nav"
            className={navOpen ? 'admin-nav admin-nav--open' : 'admin-nav'}
            aria-label="Admin sections"
          >
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={
                  item.id === selected ? 'admin-nav__link admin-nav__link--active' : 'admin-nav__link'
                }
                aria-current={item.id === selected ? 'page' : undefined}
                onClick={() => { setActivePage(item.id); setNavOpen(false); }}
              >
                {item.label}
              </button>
            ))}
          </nav>
        )}

        <main className="admin-main">
          {!selected && (
            <p className="admin-notice">
              You have not been given anything to edit yet. Ask a camp director
              to add you to an area.
            </p>
          )}

          {selected === 'people' && me.isAdmin && <Users currentEmail={me.email} />}
          {activeContentPage && <activeContentPage.Component key={activeContentPage.id} />}
        </main>
      </div>
    </div>
  );
```

Add the `navOpen` state beside the existing state declarations near line 48:

```jsx
  const [navOpen, setNavOpen] = useState(false);
```

The four early returns (error, loading, unregistered) keep `<main className="admin-shell">` unchanged — they have no nav to lay out.

- [ ] **Step 2: Replace the navigation rules**

In `src/admin/styles/shell.css`, replace the whole `/* --- Navigation --- */` block with:

```css
/* --- Layout ----------------------------------------------------------
   Sidebar on desktop, drawer under 48rem. The nav is in the DOM either
   way — the narrow layout hides it with `display: none` rather than
   unmounting, so toggling it never remounts the buttons or loses focus
   position. */

.admin-layout {
  display: grid;
  grid-template-columns: 13rem 1fr;
  gap: clamp(1.5rem, 1rem + 2vw, 3rem);
  align-items: start;
}

.admin-main { min-width: 0; }

.admin-header__bar {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
}

.admin-nav {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  position: sticky;
  top: clamp(1.5rem, 1rem + 2vw, 3rem);
  border-right: 1px solid var(--color-line);
  padding-right: 0.75rem;
}

.admin-nav__link {
  border: none;
  border-left: 2px solid transparent;
  background: transparent;
  font: inherit;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-muted);
  text-align: left;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
}

.admin-nav__link:hover { color: var(--color-ink); }

.admin-nav__link:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}

.admin-nav__link--active {
  color: var(--color-ink);
  border-left-color: var(--color-primary);
  background: var(--color-surface-sunken);
}

/* The drawer toggle only exists in the narrow layout. */
.admin-nav__toggle {
  display: none;
  border: 1px solid var(--color-line-strong);
  border-radius: 2px;
  background: var(--color-surface-raised);
  font: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-ink);
  padding: 0.4rem 0.8rem;
  cursor: pointer;
}

.admin-nav__toggle:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}

@media (max-width: 48rem) {
  .admin-layout {
    grid-template-columns: 1fr;
    gap: 0;
  }

  .admin-nav {
    display: none;
    position: static;
    border-right: none;
    border-bottom: 1px solid var(--color-line);
    padding: 0 0 1rem;
    margin-bottom: 1.5rem;
  }

  .admin-nav--open { display: flex; }

  .admin-nav__link {
    border-left: none;
    border-bottom: 1px solid var(--color-line);
    padding: 0.7rem 0.25rem;
  }

  .admin-nav__link--active {
    border-left: none;
    border-bottom-color: var(--color-primary);
  }

  .admin-nav__toggle { display: block; }
}
```

- [ ] **Step 3: Loosen the shell padding on small screens**

In `src/admin/styles/shell.css`, add after the `.admin-shell` rule:

```css
@media (max-width: 30rem) {
  .admin-shell { padding: 1rem 0.875rem 2rem; }
}
```

- [ ] **Step 4: Build**

```bash
npm run build
```

Expected: succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/admin/AdminApp.jsx src/admin/styles/shell.css
git commit -m "feat: give the admin panel a responsive sidebar nav"
```

---

### Task 3: Responsive tables

The Users permission grid is Person + five areas + Role + Actions = eight columns. At 375px that overflows horizontally. Below 48rem each row becomes a stacked block whose cells are labelled from `data-label`.

**Files:**
- Modify: `src/admin/styles/tables.css`, `src/admin/pages/Users.jsx`

**Interfaces:**
- Consumes: the `.admin-table` markup already in `Users.jsx`.
- Produces: the `data-label` convention — every `<td>` in an `.admin-table` carries `data-label` matching its column header. Any future table follows it.

- [ ] **Step 1: Add the stacked mode**

Append to `src/admin/styles/tables.css`:

```css
/* --- Narrow screens ---------------------------------------------------
   A table with eight columns cannot shrink to a phone. Below 48rem each
   row becomes its own ruled block and every cell is labelled from
   `data-label`, so the header row is not needed and is hidden from both
   sight and the accessibility tree (`display: none` does both).

   The markup does not change, so there is only one table to maintain. */

@media (max-width: 48rem) {
  .admin-table,
  .admin-table tbody,
  .admin-table tr,
  .admin-table th,
  .admin-table td {
    display: block;
  }

  .admin-table thead { display: none; }

  .admin-table tr {
    border-bottom: 2px solid var(--color-ink);
    padding: 0.75rem 0;
  }

  .admin-table tbody th,
  .admin-table td {
    border-bottom: none;
    padding: 0.3rem 0;
  }

  .admin-table tbody th {
    font-size: 1rem;
    padding-bottom: 0.5rem;
  }

  /* The label sits inline with the value rather than above it: these are
     short cells (a checkbox, a role name), and stacking them would make
     each row twice as tall for no gain. */
  .admin-table td[data-label]::before {
    content: attr(data-label);
    display: inline-block;
    min-width: 9rem;
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--color-ink-soft);
  }
}
```

- [ ] **Step 2: Add `data-label` to the Users cells**

In `src/admin/pages/Users.jsx`, the permission cell (around line 142) becomes:

```jsx
                <td key={area.key} data-label={area.label}>
```

The role cell (around line 154):

```jsx
              <td data-label="Role">{user.isAdmin ? 'Administrator' : 'Editor'}</td>
```

Leave the actions cell (line 155) without a `data-label` — its column header is `visually-hidden`, so a label would be inventing a heading that does not exist on desktop. The remove button names its own purpose.

- [ ] **Step 3: Build**

```bash
npm run build
```

Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/admin/styles/tables.css src/admin/pages/Users.jsx
git commit -m "feat: stack admin tables on narrow screens"
```

---

### Task 4: Shared state components

Every page writes its own loading paragraph, error paragraph and empty-state text. This gives them one component each, so the vocabulary is consistent and a future page gets it for free.

**Files:**
- Create: `src/admin/components/States.jsx`, `test/admin/states.test.jsx`
- Modify: `src/admin/styles/shell.css`

**Interfaces:**
- Consumes: nothing.
- Produces: three named exports —
  - `Busy({ label })` → `<p class="admin-notice" aria-busy="true">`, `label` defaults to `'Loading…'`
  - `Failure({ message })` → `<p class="admin-error" role="alert">`, renders nothing when `message` is falsy
  - `Empty({ children })` → `<p class="admin-notice admin-notice--empty">`

- [ ] **Step 1: Write the failing test**

Create `test/admin/states.test.jsx`:

```jsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { Busy, Failure, Empty } from '../../src/admin/components/States.jsx';

let container;

function render(element) {
  container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(element));
  return container;
}

afterEach(() => {
  container?.remove();
  container = null;
});

describe('Busy', () => {
  it('marks itself busy for assistive technology', () => {
    const el = render(<Busy />);
    const p = el.querySelector('p');
    expect(p.getAttribute('aria-busy')).toBe('true');
    expect(p.textContent).toBe('Loading…');
  });

  it('takes a custom label', () => {
    const el = render(<Busy label="Uploading…" />);
    expect(el.textContent).toBe('Uploading…');
  });
});

describe('Failure', () => {
  it('announces itself as an alert', () => {
    const el = render(<Failure message="Nope" />);
    const p = el.querySelector('p');
    expect(p.getAttribute('role')).toBe('alert');
    expect(p.textContent).toBe('Nope');
  });

  it('renders nothing when there is no message', () => {
    // Pages hold error state as null most of the time. Rendering an empty
    // alert box in that case would announce a failure that has not happened.
    const el = render(<Failure message={null} />);
    expect(el.innerHTML).toBe('');
  });
});

describe('Empty', () => {
  it('renders its children', () => {
    const el = render(<Empty>Nothing here yet.</Empty>);
    expect(el.textContent).toBe('Nothing here yet.');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run test/admin/states.test.jsx
```

Expected: FAIL — cannot resolve `src/admin/components/States.jsx`.

If it instead fails on a missing `jsdom` package, install it as a dev dependency with `npm install -D jsdom` (this repo uses npm — `package-lock.json`) and re-run.

- [ ] **Step 3: Write the component**

Create `src/admin/components/States.jsx`:

```jsx
/**
 * The three states every admin page passes through.
 *
 * Each page used to write its own markup for these, which drifted: some
 * errors were announced to screen readers and some were not, and "no items
 * yet" was worded four different ways. One component each keeps the
 * vocabulary consistent and gives a new page the right behaviour by default.
 */

/** A page or section waiting on the network. */
export function Busy({ label = 'Loading…' }) {
  return <p className="admin-notice" aria-busy="true">{label}</p>;
}

/**
 * A failure worth interrupting for.
 *
 * Renders nothing when there is no message: pages hold this state as null
 * most of the time, and an empty `role="alert"` box would announce a
 * failure that has not happened.
 */
export function Failure({ message }) {
  if (!message) return null;
  return <p className="admin-error" role="alert">{message}</p>;
}

/** A list with nothing in it yet. */
export function Empty({ children }) {
  return <p className="admin-notice admin-notice--empty">{children}</p>;
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run test/admin/states.test.jsx
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Style the empty state**

Append to `src/admin/styles/shell.css`:

```css
.admin-notice--empty {
  border: 1px dashed var(--color-line-strong);
  border-radius: 2px;
  padding: 1.25rem;
  background: var(--color-surface-sunken);
}
```

- [ ] **Step 6: Commit**

```bash
git add src/admin/components/States.jsx test/admin/states.test.jsx src/admin/styles/shell.css
git commit -m "feat: add shared admin busy, failure and empty states"
```

---

### Task 5: Adopt the shared states in AdminApp

Only `AdminApp.jsx` in this task. The seven page components keep their own markup for now — converting them is mechanical, touches every file, and would bury the structural change in this phase's diff. Phase 2 converts `Media.jsx` as it rewrites it.

**Files:**
- Modify: `src/admin/AdminApp.jsx`

**Interfaces:**
- Consumes: `Busy`, `Failure` from `src/admin/components/States.jsx`.
- Produces: nothing new.

- [ ] **Step 1: Import the components**

Add below the existing imports in `src/admin/AdminApp.jsx`:

```jsx
import { Busy, Failure } from './components/States.jsx';
```

- [ ] **Step 2: Use them in the early returns**

Replace the error early return (currently lines 54-63) with:

```jsx
  if (error) {
    return (
      <main className="admin-shell">
        <h1>Admin</h1>
        <Failure message="We could not confirm your access. Try reloading the page." />
      </main>
    );
  }
```

Replace the loading early return (currently lines 65-71) with:

```jsx
  if (!me) {
    return (
      <main className="admin-shell">
        <Busy />
      </main>
    );
  }
```

Leave the `!me.registered` return as it is — it is not an error, it is a normal state with prose, and `role="alert"` would misannounce it.

- [ ] **Step 3: Build**

```bash
npm run build
```

Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/admin/AdminApp.jsx
git commit -m "refactor: use the shared state components in AdminApp"
```

---

### Task 6: Full test run

**Files:** none.

- [ ] **Step 1: Run everything**

```bash
npm test
```

Expected: the whole suite passes, including `test/admin/permission-areas.test.js` and the new `test/admin/states.test.jsx`.

If anything fails, fix it before continuing. Do not proceed to Task 7 with a red suite.

---

### Task 7: Browser verification

Required by CLAUDE.md: "Frontend is not done until it has been rendered and looked at." A passing build has never caught the bugs this repo actually gets.

**Files:** none, unless a defect is found.

- [ ] **Step 1: Start both servers**

The admin panel calls `/api`, which vite proxies to the worker. Without the worker running, `getMe()` fails and the panel renders only its error state — which is not the thing being verified.

```bash
npx wrangler dev --port 8788 &
npm run dev
```

- [ ] **Step 2: Invoke the verify-ui skill**

Use the `verify-ui` skill against `http://localhost:5173/admin.html`.

Check at three widths:

| Width | What must be true |
|---|---|
| 375px | Nav is hidden until "Sections" is pressed. No horizontal scrolling anywhere. Users table rows are stacked and every permission checkbox has a visible label. |
| 768px | Same drawer behaviour (the breakpoint is 48rem = 768px, so this width is *at* the boundary — confirm which side it lands on and that it is not visually broken either way). |
| 1280px | Sidebar is visible, sticky on scroll, active item marked with the navy left rule. |

- [ ] **Step 3: Check the console**

Read the browser console. Expected: no errors and no React warnings. A key warning or a hydration error here is a real defect, not noise.

- [ ] **Step 4: Confirm the bans hold**

Look at the rendered page against the Global Constraints list: no shadows, no gradients, no uppercase headings, no pill buttons, no hover lifts. Check a hover state on a nav item and a button.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A src/admin
git commit -m "fix: <what the browser pass found>"
```

If nothing was found, skip this step — do not create an empty commit.

---

## Self-Review

**Spec coverage.** Section 1 of the spec lists four requirements. Sidebar/drawer nav → Task 2. Stacked tables → Task 3. Extracted primitives → Tasks 1 and 4. One vocabulary for busy/empty/error → Tasks 4 and 5. Browser verification at three widths → Task 7. Field Guide direction and the ban list → Global Constraints, checked in Task 7 Step 4.

**Placeholders.** None. Every code step carries the literal code; every command carries its expected result.

**Type consistency.** `Busy`, `Failure`, `Empty` are defined in Task 4 and consumed in Task 5 under those exact names. `Failure` takes `message`, `Busy` takes `label`, `Empty` takes `children` — consistent in the test, the component and the call sites. The `data-label` convention is defined in Task 3 Step 1 and applied in Step 2.

**Scope.** No schema change, no new permission, no API change. Phase 2 has a clean base to build media on.
