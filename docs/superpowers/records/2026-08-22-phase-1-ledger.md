# SDD ledger — plan: docs/superpowers/plans/2026-08-22-phase-1-foundation.md

Spec: docs/superpowers/specs/2026-08-22-admin-panel-design.md (read, reachable)
Worktree: .worktrees/admin-panel on branch feat/admin-panel
Baseline: build passes, no tests yet (expected — plan introduces the suite)

## Pre-flight scan

### Cross-task rows (tasks sharing a file or interface)

| Tasks | Produces → Consumes | Finding |
|---|---|---|
| 1 → 5, 6, 7 | `worker/app.js` rewritten in full by each | OK. Each later version is a superset; T7's final version retains T1's asset fallback, T5's `requireAuth` + `/me`, T6's `/users`. Verified by reading all four blocks. |
| 1 → 2, 8, 9 | `migrations/` dir | OK. T1 creates empty dir + `.gitkeep`; T2 adds `0001_users.sql`; T8 applies in CI; T9 applies remotely. No ordering conflict. |
| 1 → 9 | `wrangler.jsonc` | OK. T1 writes the file with `POLICY_AUD: ""` placeholder; T9 fills the real AUD after the Access app exists. Sequenced correctly — the value cannot exist before T9. |
| 2 → 4, 5, 6 | `users` table columns | OK. Columns `can_blog/can_media/can_merch/can_campinfo/is_admin` match `toFlags()` in T6 and the mapping in T4 `loadUser`. Verified name-by-name. |
| 3 → 5 | `verifyAccessJwt(request, env)`, `AuthError` | OK. T5 middleware imports both; signature and throw-contract match T3's definition. |
| 4 → 5, 6 | `loadUser`, `hasPermission`, `AREAS` | OK. T5 imports `loadUser`/`hasPermission`; T6 imports `AREAS`/`loadUser`. All three exported by T4. |
| 5 → 6 | `requireAdmin` | OK. T6's `users.use('*', requireAdmin)` matches T5's export. |
| 5 → 7 | `/api/admin/me` response shape | OK. T7's `AdminApp` reads `registered`, `email`, `name`, `isAdmin`, `permissions` — all five present in T5's two return paths. |
| 6 → 7 | users API shape | OK. T7's `Users.jsx` reads `users[].email/name/permissions/isAdmin`; T6's GET returns exactly these plus `createdAt`. |
| 7 → 8 | `vite.config.js` gh-pages base removal | OK. T7 drops the `DEPLOY_TARGET` base; T8 deletes the workflow that used it. Correct order — config change lands before the consumer is removed. |

### Per-task internal consistency

| Task | Finding |
|---|---|
| 1 | **DEFECT FOUND & FIXED** — `readD1Migrations` imported from `@cloudflare/vitest-plugin/config`, a subpath that does not exist in v1.0.0 (verified: `exports` has only `.` and `./types`). Would have failed every test at config load. Corrected to the package root. Also collapsed a redundant double-import of `cloudflare:test` in `test/setup.js`. |
| 1 | Empty `migrations/` at T1 verified safe: `readD1Migrations('./migrations')` returns `[]`, does not throw. |
| 2 | Tests assert `created_at` is a number; schema uses `INTEGER DEFAULT (unixepoch())`. Consistent. |
| 3 | Tests generate a local keypair and stub `globalThis.fetch` for the certs endpoint — no network. `vi.spyOn` on ES module exports verified working under Vitest 4.1.11 in a scratch repo. |
| 4 | `hasPermission(user,'billing')` expected false for an admin; implementation checks `AREAS.includes(area)` before the admin short-circuit. Consistent. |
| 5 | Self-consistent. Added `requireArea` coverage during plan self-review (it is written here, consumed in Phase 2 — an untested guard protects nothing). |
| 6 | Self-lockout guards tested both ways (own admin flag, own deletion) and implemented in both handlers. Consistent. |
| 7 | `/admin` explicitly routed because `not_found_handling: single-page-application` would otherwise serve the public `index.html`. Correctly identified in the plan text. |
| 8 | Uses `grep -l Pages` to find the file rather than hardcoding a name. Robust. |
| 9 | No bootstrap endpoint; first admin seeded via wrangler CLI. Deliberate — an unauthenticated promote-me route is the exact hole this system closes. |

### Rulings

Ruling: import `readD1Migrations`/`cloudflareTest` from `@cloudflare/vitest-plugin` root, not `/config` — the `/config` subpath does not exist in v1.0.0, verified against the installed package's `exports` map. Cost if wrong: none; verified empirically before any code was written.

## Progress

Infra: D1 database `bmxc` created by controller — id `18788aa1-60db-4026-803c-c556e0b1401e` (account 9569781c361a80bd0b96dedbac0aca6d). Task 1 was told to use a zero placeholder; controller replaces it after Task 1 lands.
Constraint (CLAUDE.md): deploy token is `zone: read` only — DNS and zone settings require the Cloudflare dashboard. Affects Task 9 (creating the Access application) and Phase 4 (MX cutover). Those steps are human-in-the-loop by necessity, not by choice.

Task 1: implementer DONE (commit bcbbd3b). Controller independent checks:
  - `npm test` → 2/2 pass (with dist/ present)
  - Public site provably unchanged: `git diff` touches no src/public/index.html/vite.config.js, AND built output hash identical to main (8c2bb8177620b1e1 both sides)
  - REPRODUCED ISSUE: `rm -rf dist && npm test` → 1 failure. Suite depends on dist/ existing; clean CI checkout would fail. Handed to reviewer for severity + minimal fix.
  - Deviation (vitest.config.js miniflare bindings) handed to reviewer to assess.
Task 1: review — spec ✅, quality Needs work. 1 Critical (test suite depends on gitignored dist/), 2 Important (undisclosed deletion of wrangler.jsonc comment; vitest config deviation not minimized), 1 Minor.
Task 1: minor (deferred): unused `SELF` import in test/worker/app.test.js — came from the brief verbatim; will trip a future lint pass.
Task 1: fix round 1/5 dispatched (resumed original implementer) — 3 findings sent.
Task 1: fix round 1 implemented (commit e7a13d5). Controller independently verified: pretest hook runs vite build (observed build output), `rm -rf dist && npm test` → 2/2 pass; wrangler.jsonc comment restored verbatim; modules/moduleRules removed, d1Databases+assets retained. Full test cycle 2.0s — pretest overhead negligible. Scoped re-review dispatched.
Task 1: fix round 1/5 (3 addressed, 0 open; commits bcbbd3b..e7a13d5)
Task 1: complete (commits f512c23..e7a13d5, review clean)
Controller: replaced placeholder database_id with real bmxc id (commit follows e7a13d5). Tests still 2/2.
Task 2: implementer DONE (commit 7058006). Controller verified: schema matches brief exactly, all 5 permission columns correctly named, timestamps INTEGER unixepoch() (constraint held), 5/5 tests pass, diff touches only the 2 intended files. Review dispatched.
Task 2: review — spec ✅, quality Approved. No Critical. Reviewer's "Important" was self-described as acceptable (audit timestamp auto-population covered end-to-end by Task 6), so recorded as deferred minor, not a fix-loop trigger.
Task 2: minor (deferred): audit_log test does not assert created_at auto-population or id autoincrement — Task 6 exercises audit behavior end-to-end.
Task 2: minor (deferred): duplicate-email test uses bare .rejects.toThrow() without asserting the constraint error specifically.
Task 2: complete (commits 91a57a6..7058006, review clean)
Task 3: implementer DONE (commit 7d950ef). Controller added adversarial tests (commit 44c2407): attacker-key-signed, alg=none, tampered-payload, and empty-POLICY_AUD all reject. 15/15 suite green.
Task 3: controller probe — non-string `email` claim is COERCED, not rejected: object -> "[object object]", array -> "a@b.com,admin@c.com". Fails closed (no such users row could match unless an admin deliberately created it), and Access itself always issues a string claim. Defence-in-depth gap, not a live hole. Handed to reviewer; will fix if reviewer rates it Important or above.
Task 3: review — spec ✅, quality Approved. All 7 security properties HOLD. No Critical.
Ruling: the reviewer's Important finding (jwtVerify's `cause` discarded, so an Access outage is indistinguishable from an attack in logs) is real but explicitly scoped to Task 5's caller, not this file. Carrying it into Task 5's dispatch as a requirement rather than reopening Task 3. Cost if wrong: an Access/JWKS outage is harder to diagnose until Task 5 lands — bounded, since Task 5 is next.
Ruling: non-string `email` claim coercion (controller-found, reviewer-confirmed Minor) will be tightened in Task 3's file now, since it is one line and Task 5's admin gate depends on exact email matching. Cost if wrong: none — strictly narrows what is accepted.
Task 3: carry into Task 5 — verify the HTTP layer returns ONE generic 403 body regardless of which AuthError message fired (reviewer's property-6 caveat).
Task 3: fix round 1/5 (email-claim hardening addressed; commit 30b972b). Controller verified: typeof check + non-empty guard, no String() coercion, 19/19 green.
Task 3: complete (commits 7058006..30b972b, review clean)
Task 4: implementer DONE (commit cea4cf5). Controller verified: parameterised .bind() query (no interpolation), exact `=== 1` boolean conversion, read-only (SELECT only), area validated before admin short-circuit.
Task 4: controller found coverage gap — no test proved the table stays empty after a failed lookup. Added test/worker/no-autocreate.test.js (commit 877f8f2): 3 tests locking the no-privilege-escalation invariant. 29/29 green.
Task 4: review — spec ✅, quality Approved, all 6 security properties HOLD.
Task 4: minor (deferred): `SELECT *` in loadUser rather than explicit columns.
Task 4: complete (commits 30b972b..877f8f2, review clean)
Task 5: implementer DONE (commit 7a12a01). 41/41 green across 7 files. Controller verified: Addition A (error.message only in console.error, never in a response) and Addition B (all 3 rejection paths return identical literal {error:'Forbidden'} 403) both correctly implemented.
Task 5: controller MUTATION TEST — replaced the verifyAccessJwt call with a header-trusting stub; 9 of 12 me.test.js tests failed. Confirms the vi.spyOn mocking is NOT vacuous: tests genuinely detect a middleware that skips verification. Middleware restored byte-identical (git diff clean).
Task 5: controller verified public site source untouched since main across all tasks 1-5.
Task 5: review — spec ✅ (incl. Additions A and B), quality Approved. All 4 auth-gate properties hold. Reviewer empirically confirmed mount-order semantics AND that the bypass failure mode is real (route registered before app.use is ungated).
Task 5: minor (deferred): no app.onError handler — Hono's default 500 leaks nothing, but there is no structured logging for unexpected throws.
Task 5: minor (deferred): requireArea's null-safety lives in permissions.js one file away; a future edit there could break it without middleware.js tests explaining why.
Task 5: complete (commits 877f8f2..7a12a01, review clean)
Constraint carried forward: every new admin route MUST be mounted after `app.use('/api/admin/*', requireAuth)` in worker/app.js. A route registered before it is completely ungated.
Task 6: implementer DONE (commit f8a5573). 53/53 green. Controller verified mount order (line 11 after line 9) and no interpolated SQL.
Task 6: IMPORTANT PLATFORM FINDING (implementer-discovered, controller-reproduced) — @cloudflare/vitest-plugin v1.0.0 isolates D1 per test FILE, not per test; applyD1Migrations only applies UNAPPLIED migrations, so it created tables once and then no-opped. Rows leaked between tests in a file. The old test/setup.js comment claimed the opposite. Controller fixed it (commit 90d4c20): beforeEach now DELETEs from all tables + resets sqlite_sequence. Suite verified order-independent: 53/53 under --sequence.shuffle x3.
Task 6: controller probe — PATCH permissions is REPLACE semantics, not merge. Sending {permissions:{blog:true}} silently sets media/merch/campinfo to false. NOT a live bug: Task 7's UI spreads the full object ({...user.permissions}), so all four are always sent. Undocumented and untested though; handed to reviewer.
Task 6: review — spec ✅, quality Needs work. 1 Critical (partial-PATCH silently revokes omitted permissions), 2 Important (PATCH/DELETE lack non-admin 403 tests; 409 duplicate check is read-then-write with no transaction), 3 Minor.
Ruling: fix the Critical by MERGING partial permissions over existing rather than replacing. Rationale: replace-semantics is a trap that fails silently and destructively, and merge is what every caller would expect from PATCH. The reviewer overstated it as a live bug (Task 7's UI sends all four keys, verified), but a latent destructive default is still worth closing. Cost if wrong: a caller wanting to clear a permission must send it explicitly as false — which is the safer failure direction.
Ruling: also fix both Important findings in the same round — the missing PATCH/DELETE non-admin tests are cheap and guard a privilege-escalation surface, and mapping the D1 unique-constraint error to 409 is a one-line catch. Cost if wrong: minimal added test surface.
Ruling: make test/setup.js clear tables discovered from sqlite_master rather than a hardcoded list. Reviewer flagged the stale-list omission hazard; later phases add tables (blog, media, merch) and a forgotten DELETE would silently reintroduce order-dependent flakiness. Cost if wrong: slightly more complex setup, but it cannot go stale.
Task 6: fix round 1 applied (commit 547b2ef). Controller independently verified the merge fix: all-four user PATCHed with {blog:false} -> {blog:false,media:true,merch:true,campinfo:true}; explicit false still clears. 60/60 green.
Task 6: controller coercion probe — toFlags uses truthiness, so permissions:{blog:"false"} GRANTS blog (non-empty string is truthy), and campinfo:[] grants it too. permissions:"not-an-object" is safely ignored (existing preserved, 200). Admin-only endpoint and the UI sends real booleans, so not exploitable — but "false" granting access is a surprising failure mode. Awaiting reviewer's independent call before deciding whether to tighten.
Task 6: fix round 1/5 (4 addressed, 0 open; commits 90d4c20..547b2ef). Re-review confirmed: merge fix correct, PATCH/DELETE non-admin 403 tests added, 409 catch scoped narrowly to UNIQUE-constraint only (rethrows everything else, no raw D1 message leaks), dynamic sqlite_master table discovery. Audit tests for PATCH+DELETE present. 60/60 under --sequence.shuffle x2.
Task 6: minor (deferred): toFlags uses truthiness — permissions:{blog:"false"} grants blog, {campinfo:[]} grants campinfo. Reviewer and controller independently rated Low/defer: endpoint is admin-only, UI sends real booleans, non-object degrades safely. Fix with a strict boolean check in a later hardening pass.
Task 6: minor (deferred): EMAIL_PATTERN has no length bound; a 5000-char local-part would be accepted.
Task 6: complete (commits 7a12a01..547b2ef, review clean)
Note: re-review had to be re-dispatched once — first attempt died when the machine slept mid-response, not an agent failure. State verified intact afterward.
Task 7: implementer was KILLED by machine sleep before committing or reporting. Controller verified the work independently and committed as 1cf9f96, and wrote the report as a reconstruction (labelled as such).
Task 7: DEVIATION (correct, and important) — implementer rejected the brief's "second rollupOptions.input" approach and used a separate vite.admin.config.js with emptyOutDir:false. Reason: a shared Rollup graph hoists React/tokens.css into a chunk loaded by both pages, changing the PUBLIC entry's emitted files. Controller confirmed public hash 8c2bb8177620b1e17856 is byte-identical to the main baseline, so the constraint holds.
Task 7: DEVIATION 2 — brief's CSS used nonexistent tokens (--color-paper, --color-rule) WITH fallbacks that would have silently masked the error. Replaced with real tokens, no fallbacks.
Task 7: controller verified end-to-end via wrangler dev: GET /admin -> id="admin-root", GET / -> id="root", GET /api/admin/users unauthenticated -> 403.
Task 7: controller found — src/admin/lib/api.js line 19 `return res.json()` on the SUCCESS path is unguarded (the error path IS guarded with .catch). An expired Access session returns 200 + an HTML login page, which throws a raw SyntaxError. Confirmed by simulation. In AdminApp it coincidentally renders a sensible message; in Users.jsx it would surface the raw parser error to the user. Handed to reviewer.
Task 7: review — spec ✅, quality Approved. BOTH deviations judged JUSTIFIED. Reviewer went further than controller and EMPIRICALLY REPRODUCED the brief's original approach in an isolated repo copy: merging admin.html into vite.config.js rollupOptions.input split the public bundle (index-2dohsoMC.js 239kB -> main-*.js 51kB + shared tokens-*.js 187kB) and changed index.html itself. The plan's own instruction would have broken the plan's hardest constraint. Deviation was necessary, not merely defensible.
Task 7: findings — 0 Critical. Important #1: no re-entrancy guard on togglePermission/handleRemove (server-safe; UI can flicker/show stale state under rapid clicks). Important #2: vite.admin.config.js hardcodes base:'/' ignoring DEPLOY_TARGET — MOOT, Task 8 removed DEPLOY_TARGET entirely (verified: no references remain anywhere).
Task 7: minor (deferred): api.js success-path res.json() unguarded (controller-confirmed: expired Access session -> 200 + HTML -> raw SyntaxError shown to user).
Task 7: minor (deferred): no aria-busy on the invite submit button while busy.
Ruling: fix Task 7's Important #1 (re-entrancy guard) and the api.js Minor in one round. Both are small, both are user-facing on a bad day, and this is the last chance before the panel goes to beta testers. Cost if wrong: minor added UI state complexity.
Task 8: implementer DONE (commit ed8e6c9). Controller verified: only deploy-cloudflare.yml remains; order is npm ci -> build -> d1 migrations -> deploy (schema before code); public hash still 8c2bb8177620b1e17856; single-input comment preserved; 60/60 green.
Task 7: fix round 1 (commit eec3fa9). Controller verified: both handlers use finally{clearPending(key)} so a FAILED request always releases the control (no permanent-disable hole — the failure mode that would have been worse than the original bug); key namespacing `email:area` vs `remove:email` prevents collision on the same row; api.js success-path parse now throws an ApiError with a non-technical session-expiry message. Public hash still 8c2bb8177620b1e17856, 60/60 green, no banned CSS patterns.
Task 8: complete (commit ed8e6c9, verified by controller)
Task 7: fix round 1/5 (2 addressed, 0 open; commits 1cf9f96..eec3fa9). Re-review: all addressed, no new breakage.
Task 7: complete (commits 547b2ef..eec3fa9, review clean)
Task 8: re-review confirmed all requirements MET (workflow deleted, migration step ordered correctly, DEPLOY_TARGET removed with single-input comment preserved).
Task 9: controller completed every step that does not require the dashboard:
  - Remote D1 migration applied (0001_users.sql, 4 commands executed)
  - First admin seeded in PRODUCTION: jsnapoli1@gmail.com / Jack / is_admin=1 (verified by SELECT)
  - docs/ACCESS-SETUP.md written with click-by-click instructions + verification order
Task 9: BLOCKED on user — creating the Access application requires the Cloudflare dashboard (deploy token is zone:read only per CLAUDE.md). Need POLICY_AUD (the app's Audience tag) and TEAM_DOMAIN from the user. Until set, the Worker denies all /admin and /api/admin/* traffic — fails closed, which is correct.

## Final whole-branch review (opus)
Verdict: NOT YET — fix C-1 and I-1, then ship. Auth path swept with 20 anonymous request shapes (case variants, //, .., %2f, OPTIONS/HEAD): every privileged path returned identical 403, DB empty afterward. Public-site invariant verified TWO ways incl. a clean `git archive` build of main diffed by SHA-256 across all 30 emitted files — byte-identical.
Ruling: my earlier deferral of the toFlags truthiness issue was WRONG. I reasoned about `permissions` and never checked `isAdmin` — the one field where truthiness decides who holds power. Reviewer caught it; I reproduced it: PATCH {isAdmin:0} bypasses the strict `=== false` guard (200, is_admin=0, then 403 locked out, no panel path back); PATCH {isAdmin:"false"} GRANTS admin. Fixing now with strict booleans in toFlags + a guard that catches any demotion, not just literal false. Cost if wrong: none — strictly narrows what is accepted.
Ruling: also fixing I-1 (initial-load catch stores the Error object, not .message, so React 19 unmounts the tree -> white screen for a non-technical director on any expired session) and I-3 (no app.onError -> unexpected faults produce a bare 500 with zero logs). Both cheap, both user-facing on a bad day.
Ruling: I-2 (panel cannot create a second admin, and cannot edit names) is a SCOPE observation, not a defect — Phase 1's plan never specified those controls. Not fixing; documenting in the handoff so the beta tester is not hunting for a control that was never built. Cost if wrong: user asks for it, we add it in a later phase.
Final review: minor (deferred): duplicated /admin and /admin/* routes; .wrangler/ not gitignored; unbounded EMAIL_PATTERN; unused SELF import; audit detail records target only, not what changed (I-4).
Final fix wave: commit d121532 — all 5 fixes applied. Controller independently verified C-1 CLOSED with a 12-case adversarial probe (isAdmin in {0,"false",[],{},null,""} on self: none demote, none lock out; {"false","no",[],{},1} on another user: none grant admin; omitted isAdmin preserves existing).
Controller added test/worker/no-over-rejection.test.js (commit b3de29c) pinning what the hardening must NOT break: admin can still edit own name and permissions, isAdmin:true on self succeeds, 404 stays 404 (onError does not swallow), ordinary emails incl. +addressing still accepted while the 254-char bound rejects. 82/82 across 9 files.
Final fix wave re-review: ALL 5 findings ADDRESSED, 0 open, no new breakage. Reviewer independently traced self/non-self x {undefined,true,false,0,"false",[],{},null,"true",1} and verified the exact 254/255 email boundary. VERDICT: safe for beta testers.
Task 9: complete except the dashboard steps (blocked on user — Access application + POLICY_AUD/TEAM_DOMAIN).
PHASE 1 COMPLETE (except user-gated Access setup). 82/82 tests, 9 files, public site byte-identical.
