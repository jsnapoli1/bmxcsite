# SDD ledger — plan: docs/superpowers/plans/2026-08-23-phase-3-media-blog.md

Spec: docs/superpowers/specs/2026-08-22-admin-panel-design.md
Worktree: .worktrees/phase3 on branch feat/media-blog
Baseline: 196/196 green. Phases 1, 2, 4 all live in production.

## Pre-flight scan

| Tasks | Produces → Consumes | Finding |
|---|---|---|
| 1 → 2 | media table + MEDIA binding | OK. Repository reads exactly the columns 0003 creates. |
| 2 → 3 | storeUpload/publishMedia/getPublicObject | OK. Routes consume all three. |
| 1 → 4 | media key referenced by blog hero | OK. Blog validates the reference points at PUBLISHED media. |
| 4 → 5 | body_markdown | OK. Renderer consumes the stored markdown; storage does not pre-render. |
| 5 → 6 | markdown renderer | OK. Public blog pages render through it. |
| 3,6 → 7 | media + blog APIs | OK. Editors consume both. |
| ALL → app.js | route mounting | CRITICAL INVARIANT: every admin route mounts AFTER app.use('/api/admin/*', requireAuth) at worker/app.js. Public media/blog routes mount on separate non-admin prefixes. |

Per-task: no placeholders. Task 5 (markdown) is the highest-risk task — staff-authored content rendered into public pages.

### Rulings carried in from earlier phases
Ruling: media is private by default with NO publish-on-upload path. CLAUDE.md notes some camp photos show individually identifiable minors. Exposure must require a deliberate, attributable action. Cost if wrong: publishing takes one extra click.
Ruling: the DATABASE is the authority for what is public, not the presence of an R2 object. getPublicObject must check the row's status and return null unless published, so an object left in public/ by a partial failure is still not served.
Ruling: raw HTML is disabled entirely in markdown rather than sanitised. Removing the capability beats filtering it. Cost if wrong: staff cannot embed HTML — acceptable, they write prose.

## Progress
Infra: R2 bucket `bmxc-media` already created by controller (2026-08-23). Task 1 must NOT run `r2 bucket create`; only add the binding.
Constraint: CI cannot apply D1 migrations (token lacks D1:Edit). 0003/0004 must be applied by hand with `npm run migrate:remote`.
Constraint: `--remote` seeding/tooling needs `remote: true` on the binding (wrangler 4.125 field name; NOT experimental_remote). See scripts/seed-content.js for the temp-config pattern.
Task 1: DONE (commit b3e613f). Implementer was killed by machine sleep before writing its report; work was committed cleanly and the controller verified it independently and wrote the report as a labelled reconstruction. Verified: status defaults to 'private', unixepoch timestamps, index on (status, uploaded_at DESC), MEDIA binding points at the EXISTING bmxc-media bucket (confirmed exactly one bucket, no orphan), r2Buckets added to vitest config. 199/199.
Task 2: DONE (commit 7ade04a). 213/213, order-independent across 3 shuffled runs.
Task 2: controller adversarial probe (commit e5f6b05, 8 tests kept permanently) — HTML renamed .jpg refused; declared-PNG-with-JPEG-bytes refused; traversal filename cannot shape the key (key has no `..` or `/`, filename kept for display only); uploaded photo NOT publicly reachable; ORPHAN IN public/ WITH A PRIVATE ROW STAYS UNREACHABLE (the load-bearing property — database is the authority, not the bucket); publish->unpublish returns to unreachable; unknown key not served.
Controller added a case the plan did not specify: SVG is refused. SVG is a genuine XSS vector that would otherwise pass as "an image". 221/221.
Controller verified getPublicObject reads the D1 row FIRST with a strict `!== 'public'` denial, and keys are crypto.randomUUID() with the filename never touching the path.
Task 2: review — spec ✅, quality Approved, NO EXPOSURE PATHS. Reviewer enumerated all 5 routes by which bytes could reach a public reader; every one passes the database-first gate. Explicitly concluded the design holds even where cleanup is incomplete.
Task 2: fix round 1 (commit bd90a0c) — storeUpload cleanup guarded so the ORIGINAL error always surfaces (test asserts the D1 unique-constraint error, not the R2 failure); publishMedia given the mirror rollback with `.rejects.toBe(dbError)` identity assertion plus a companion test that getPublicObject still returns null after a failed publish; listMedia's fails-closed default documented. Controller verified.
Task 2: controller chased the reviewer's reported flake — 3 consecutive full runs, 252/252 each. Does not reproduce; likely a transient from a dev server left running during the review.
Task 3: DONE (commit 7478e56). Mount ordering verified by controller: admin media at app.js:22 AFTER requireAuth at :18; public /media at :27 on a sibling prefix.
Task 3: controller probe (commit 539eb99, kept permanently) — a private photo returns 404 with `{"error":"Not found"}` and NO image bytes; no anonymous caller reaches any admin verb and the photo stays private afterward; a published photo IS served with immutable caching and its stored content type; unknown key 404 not 500.
Note on method: my first assertion expected a zero-length 404 body and failed at 21 bytes. I inspected the content rather than assuming a leak — it was the JSON error message. My test was wrong, not the code.
Note: two agents edited this worktree concurrently (my probe tests vs. the Task 2 fix round). Resolved by committing only my own file and letting the fix agent commit only its two. No conflict.
Ruling: Task 5 will use `markdown-it@15` with `html: false`, despite the plan's "no new dependencies" constraint. Hand-rolling a Markdown parser on a path where staff-authored content reaches public pages is exactly the wrong call — the plan itself says "Do NOT hand-roll a Markdown parser", so the constraint and the task were in conflict and the task wins.
Controller verified markdown-it's behaviour empirically before choosing it:
  - <script>, <img onerror>, and even benign <b> are ESCAPED to text, not rendered — raw HTML is off entirely, so there is no sanitiser to get wrong.
  - `javascript:` and `data:` URLs are not linkified at all; they render as literal text.
  - Legitimate links, headings, and lists work.
  - Em-dashes and curly quotes pass through untouched — required, since CLAUDE.md says the camp's punctuation is their own words and must never be normalised.
Cost if wrong: one dependency on the admin/blog path. Mitigated by html:false removing the injection class at the source rather than filtering it.
Task 4: DONE (commit da7a12c). Controller probe (commit 17ea710, kept) — publishing a post whose hero image is still PRIVATE is refused and the post stays a draft with published_at null; publishing succeeds once the image is published; drafts absent from the published list; two posts titled the same get camp-week-recap and camp-week-recap-2 with neither overwriting the other; body stored as markdown not pre-rendered HTML.
Note: my probe initially failed 6/6 because I passed snake_case (body_markdown) where savePost takes camelCase (bodyMarkdown). My error — and the validation caught it rather than silently accepting an empty body, which is the right behaviour.
Task 5: DONE (commit 490325d). Implementer found the custom scheme allowlist is LOAD-BEARING: markdown-it's built-in blocking covers javascript:/vbscript:/file: but NOT tel:/ftp:, which the allowlist strips.
Task 5: controller attack suite (commit 7570858, kept) — 15 real payloads incl. svg onload, iframe, uppercase JaVaScRiPt:, tab-obfuscated java\tscript:, base64 data:, vbscript:, file:, image-src injection. None produces a live tag or handler. Legit links survive with rel="noopener noreferrer"; em-dashes and curly quotes byte-identical.
Note on method: 3 of my 19 assertions initially failed. The output was `&lt;img ... onerror=...&gt;` — fully escaped, inert. My regex matched the ESCAPED text. I fixed the assertion to require a LIVE tag rather than a substring; a substring match would fail on safe output and prove nothing. My test was wrong, not the code.
Task 6: DONE (commit f5893cf). 327/327. Implementer's browser check caught a REAL bug a passing suite would never see: the global `list-style: none` reset stripped bullets from rendered Markdown lists. Fixed.
Task 6: controller verified independently.
  - Mount order: admin blog at app.js:24 AFTER requireAuth at :19; public blog at :34, mounted BEFORE /api/content so the more specific route wins.
  - Route probe (commit kept): a draft is absent from the public index AND 404s directly, with neither response carrying its body text; a published post appears; no anonymous caller reaches any admin blog verb; unknown slug 404 not 500.
  - Browser, empty blog: renders "Nothing posted yet. Check back soon." — not blank, not a crash. Nav includes Blog.
  - Browser, seeded post: <h1> rendered, 3 <li> elements, list-style-type computed as `disc` (the bullet fix is real, not just claimed), link carries rel="noopener noreferrer", NO raw markdown showing as text, em-dash survived, ZERO elements stuck at opacity 0, zero console errors.
Task 7: DONE (commit 83f37d7). 336/336.
Task 7: IMPLEMENTER IMPROVED ON MY PLAN. My plan required alt text before publishing only in the UI. The agent noticed there was no server-side plumbing to persist or enforce it — so a UI-only rule is bypassable by any direct API call — and added PATCH /api/admin/media/:key plus a check inside publishMedia(). That is a materially stronger safety design than I specified. It required updating 11 call sites across 6 test files; controller verified the change to blog-exposure.test.js is minimal and additive (supplies alt text for the POSITIVE case only) and that the private-hero refusal assertions are untouched.
Task 7: controller verified the private-photo preview problem was solved WITHOUT adding a public endpoint — the <img> is guarded by `item.status === 'public'`, and a private row renders a placeholder with role="img" and an aria-label saying it cannot be previewed until published. No broken image, no leak.
Task 7: the banned-CSS grep hit is a FALSE POSITIVE — the word "gradient" appears only inside a comment stating none are used.
PHASE 3 TASKS ALL COMPLETE. 336 tests, 34 files.

## Controller: deploy-before-migrate test (the Phase 2 bug class, re-checked)
Phase 2 shipped a white screen in exactly this window, so I tested it before the final review rather than after. Simulated production: removed 0003/0004, wiped state, re-migrated so only 0001+0002 exist.
Result:
  - /api/content/blog -> 500, /media/:key -> 500 (no tables). Bodies leak nothing.
  - /blog -> 200, and in a real browser it renders 591 chars with header, nav and footer intact. NOT a white screen (Phase 2's failure was bodyLength 0 with an empty React root).
  - A visitor sees "The blog could not be loaded. Try again in a moment." — honest, plain, inside the normal page chrome.
  - Notably NOT a false "Nothing posted yet", which would misrepresent an outage as an empty blog. That distinction is correct and better than I would have specified.
CONCLUSION: merging and deploying before applying 0003/0004 is SAFE. The Phase 2 bug class does not recur.
Migrations restored, working tree clean, 336/336.

## Final whole-branch review (opus) — NO CRITICAL FINDINGS
Reviewer enumerated all 15 exposure paths BY EXECUTION (anonymous probes with verifyAccessJwt rejecting). Every path 1-9 requires an explicit publish; the database-first gate holds even when R2 state is inconsistent. All 17 admin routes 403 anonymously. PATCH /api/admin/media/:key cannot set status — no bypass. R2 bucket has no public dev URL or custom domain. Admin bundle contains no media keys or bytes.
Markdown->DOM judged safe: html:false means there is no author-controlled HTML to sanitise; title/excerpt reach the DOM via JSX text nodes through SplitText, never innerHTML; no meta tags built from post content.
IMPORTANT 1 (reviewer, controller-confirmed): author_email is served to anonymous readers on every public blog response. Confirmed live: an anonymous fetch of /api/content/blog returns ken@bmxc.camp along with id, status, and body_markdown. Staff email addresses exposed to anyone opening DevTools — a privacy leak on a site whose whole design constraint is not exposing people.
IMPORTANT 2: alt_text is enforced on publish but never reaches a public reader — both Blog.jsx and BlogPost.jsx hardcode alt="". The accessibility half of the requirement is unmet.
MINOR: PATCH media route is the only mutating media route with no audit row; immutable caching means an already-cached copy survives unpublish (origin 404s correctly); /api/admin/../content/blog normalises to the PUBLIC route, not a bypass.
Reviewer also caught that BOTH new migrations were deleted in the working tree at review time — it restored them. Had migrate:remote run in that state it would have applied nothing and reported success. Controller verified the tree is clean now.
Final fix wave (commit 0c685e0): 341/341, order-independent x2. Controller verified LIVE:
  - Public blog index now returns only slug, title, excerpt, published_at, hero_media_key, hero_media_alt. Single post adds body_markdown. NO author_email, id, status, created_at, or updated_at on either. Leak closed.
  - Browser: post renders correctly with the narrowed payload — h1, 3 bullets at list-style-type disc, no raw markdown, zero opacity-0 elements, and `ken@bmxc.camp` appears NOWHERE in the rendered page source.
  - git status clean, all 4 migrations present.
PHASE 3 COMPLETE — 341 tests, ready to merge.
