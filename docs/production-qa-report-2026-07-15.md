# LevelHabit production QA report

Test date: 2026-07-15  
Production URL: `https://nicolasfrechette91.github.io/LevelHabit/`  
API: `https://level-habit-api.onrender.com/api`  
Browsers: Chromium, Firefox, WebKit (Playwright 1.61) and the Codex in-app browser  
Account: authorized `smoke+1@example.com` account; password and token values were never written to artifacts.

## 1. Executive summary

LevelHabit is visually cohesive and its primary functionality is substantially working. Login validation, authenticated navigation, route refreshes, direct hash navigation, habit create/edit/complete/archive persistence, progress/achievement/analytics updates, logout guards, account persistence, responsive layouts, and the tested accessibility semantics all worked. The site has no horizontal overflow at the eight requested viewport sizes, and the Logout control is vertically aligned with the other second-row mobile header controls.

It is presentable for an informal portfolio walkthrough, but it is **not yet a polished portfolio-ready build**. Two visible authentication defects, one misleading habit-validation state, and local-storage refresh-token exposure should be addressed first.

Findings by severity:

| Severity | Count |
|---|---:|
| Critical | 0 |
| High | 0 |
| Medium | 4 |
| Low | 1 |
| Observation | 2 |

The most important risks are duplicate successful login requests in Chromium, authenticated users being able to render the sign-in screen inside the authenticated shell, misleading/missing overlength validation, and access plus refresh tokens being persisted in JavaScript-readable local storage.

Final corrected non-mutating run: **47 passed, 7 failed, 3 skipped, 0 Playwright-retry flakies**. The three skipped lifecycle cases had already passed in Chromium, Firefox, and WebKit and were skipped in the final pass to avoid creating more production records. The seven failures are the three-browser overlength defect, the three-browser authenticated-login-route defect, and Chromium's duplicate-login defect.

Required viewports tested in Chromium, Firefox, and WebKit: 320×568, 375×667, 390×844, 768×1024, 1024×768, 1280×720, 1440×900, and 1920×1080.

Not fully tested or not available:

- Cross-user isolation and object-level authorization, because only one authorized production account was supplied.
- Restore and hard-delete, because the production UI only exposes Archive.
- Editable profile/account fields and password change, because no such production controls are exposed.
- A genuinely cold backend start; the captured health calls completed in 164–205 ms.
- Browser notification delivery/permission acceptance; permission was not changed.
- Real screen-reader output, reduced-motion behavior with assistive technology, and automated Axe color-contrast rules (Axe was not installed).
- Duplicate-name and rapid habit-create submissions were not sent to production to avoid persistent record clutter.
- A deterministic refresh while the login request itself was in flight was not forced; refresh after successful authentication was covered.

## 2. Detailed defect report

### LH-AUTH-001 — Authenticated users can render the login screen inside the authenticated shell

- Severity: **Medium**
- Category: Authentication / routing / usability
- Environment: Production; Chromium, Firefox, WebKit, in-app browser; desktop and hash route
- Preconditions: User is authenticated.
- Reproduction:
  1. Sign in successfully.
  2. Navigate directly to `#/login`, or in Chromium refresh Dashboard and use Back to return to the login history entry.
  3. Observe the page.
- Expected: Redirect to `#/dashboard`, or suppress the login component for an authenticated session.
- Actual: URL/title remain `#/login` / `Sign in | LevelHabit`; the full login form renders while the authenticated toolbar, Notifications, and Log out are also visible.
- Frequency: Direct navigation reproduced 3/3 browsers and manually. Back-history variant reproduced in Chromium.
- Console: None.
- Network: No failing request required.
- Evidence: `frontend/test-results/production-audit/evidence/LH-AUTH-001-authenticated-login-route.png`; HTML-report failures for all three browser projects.
- Suggested correction: Add an anonymous-only route guard for login/register/forgot-password routes that redirects authenticated sessions to Dashboard, using replace-style navigation after login so Back cannot return to the login form.
- Confidence: High.

### LH-AUTH-002 — Rapid double-click sends two successful login requests in Chromium

- Severity: **Medium**
- Category: Authentication / duplicate submission / session integrity
- Environment: Production; Chromium consistently; WebKit intermittently. Firefox sent one request in the completed runs.
- Preconditions: Logged out; valid credentials entered.
- Reproduction:
  1. Enter valid credentials.
  2. Rapidly double-click Sign in.
  3. Count `/api/auth/login` requests.
- Expected: Submit once; immediately disable the button and ignore subsequent submit events.
- Actual: Chromium sent two `POST /api/auth/login` requests; both returned 200.
- Frequency: Reproduced repeatedly in Chromium. WebKit failed once and passed in other runs, confirming a timing-sensitive race. Firefox passed.
- Console: None.
- Network: `POST https://level-habit-api.onrender.com/api/auth/login` → 200 at 1,027 ms and 1,051 ms. Request payload contained email and password and is intentionally redacted; response bodies/tokens were not persisted.
- Evidence: `frontend/test-results/production-audit/network-results.json` (credential-free sanitized event attachment).
- Suggested correction: Set the pending flag synchronously at the start of submit, guard `submitLogin()` with `if (pending()) return`, and disable the button before the first asynchronous boundary. Consider server-side idempotence/session rotation semantics as defense in depth.
- Confidence: High.

### LH-HABIT-003 — Overlength habit values show missing or incorrect validation feedback

- Severity: **Medium**
- Category: Validation / accessibility / usability
- Environment: Production; Chromium, Firefox, WebKit; Habits route
- Preconditions: Authenticated.
- Reproduction:
  1. Enter 141 characters in Title and 1001 characters in Description.
  2. Select Create habit.
- Expected: Explain the 140-character title and 1000-character description limits, visually identify both fields, and associate each message programmatically.
- Actual: No API submission occurs, but the non-empty title is labeled “Title is required.” The overlength description receives no message. The template does not expose corresponding `aria-invalid`/described-by state for these controls.
- Frequency: 1/1 automated check; confirmed by template/source review.
- Console: None.
- Network: No `POST /api/habits` was sent.
- Evidence: `frontend/test-results/production-audit/evidence/LH-HABIT-003-overlength-validation.png`.
- Suggested correction: Branch validation copy by error key (`required`, `maxlength`), add description feedback, and wire `aria-invalid` plus `aria-describedby` exactly as the login form does.
- Confidence: High.

### LH-SEC-004 — Refresh and access tokens are stored in localStorage

- Severity: **Medium**
- Category: Security architecture
- Environment: Production SPA; all browsers
- Preconditions: Authenticated session.
- Reproduction:
  1. Sign in.
  2. Inspect only the stored-object shape for `levelhabit.auth.v1`.
- Expected: Prefer a short-lived in-memory access token and an HttpOnly, Secure, SameSite refresh cookie where architecture permits.
- Actual: `levelhabit.auth.v1` contains `accessToken`, `expiresAtUtc`, `refreshToken`, and `refreshTokenExpiresAtUtc` in JavaScript-readable local storage.
- Frequency: Consistent by automated structural check and source review.
- Console: No token logging observed.
- Network: Authorization was not observed on unrelated origins; post-logout unauthenticated `GET /api/habits` correctly returned 401.
- Evidence: Automated storage-shape assertion in `navigation.spec.ts`; token values are intentionally absent from all artifacts.
- Suggested correction: Move the refresh token to an HttpOnly/Secure/SameSite cookie and keep access tokens short-lived/in memory; retain the current strict origin check on bearer attachment.
- Confidence: High as an exposure pattern; exploitability depends on a separate XSS path, which was not found or tested.

### LH-A11Y-005 — Notification dialog does not move focus inside when opened

- Severity: **Low**
- Category: Accessibility / keyboard focus
- Environment: Production; in-app Chromium-compatible browser
- Preconditions: Authenticated.
- Reproduction:
  1. Focus and activate Notifications.
  2. Press Tab.
  3. Inspect active element relative to the element with `role="dialog"`.
- Expected: If exposed as a dialog, move focus into it and keep a logical focus order; if it is a disclosure/popover, use semantics that match that interaction.
- Actual: The dialog opens with focus remaining on the Notifications trigger outside the dialog. Escape closes it and focus is correctly restored.
- Frequency: 1/1 manual keyboard check.
- Console/network: None.
- Evidence: Manual DOM/focus observation; no screenshot needed because this is a focus-state issue.
- Suggested correction: Add an initial focus target/Close button and dialog focus management, or change to disclosure/popover semantics if focus should remain on the trigger.
- Confidence: Medium; confirm intended semantics with NVDA/JAWS/VoiceOver.

### LH-PROG-006 — Today summary includes completed habits archived on the same day

- Severity: **Observation**
- Category: Progress semantics / product clarification
- Environment: Production; all browsers
- Preconditions: Complete a habit and archive it the same day.
- Reproduction: Complete and archive the test records, then refresh Progress.
- Expected: Product decision required.
- Actual: The account showed `4/4 today` while all four E2E records were archived and no active habits were available. XP/completion history remained internally consistent.
- Frequency: Consistent after four lifecycle records.
- Console/network: None.
- Evidence: `frontend/test-results/production-audit/evidence/LH-NAV-001-logout-alignment-390x844.png` and archived-record evidence.
- Suggested correction: Clarify whether “today” means historical completions or active daily obligations; rename or exclude same-day archived habits if users should interpret it as the active queue.
- Confidence: High on behavior, product intent unknown.

### LH-PROFILE-007 — No editable account/profile surface is exposed

- Severity: **Observation**
- Category: Feature completeness
- Environment: Production; `#/progress` and redirecting `#/profile`
- Preconditions: Authenticated.
- Actual: Email and display/progress names are shown and persist, but there are no edit/save/cancel controls. `#/profile` redirects to Progress.
- Suggested correction: Either document Profile as intentionally read-only or provide a focused Account/Profile route when editing is in scope.
- Confidence: High.

## 3. Test coverage matrix

| Feature/route | Scenario | Browser | Viewport | Result | Defects |
|---|---|---|---|---|---|
| `#/login` | Direct load, title, headings, labels, favicon/static render | Chromium/Firefox/WebKit | 1280×720 | Pass | — |
| `#/login` | Empty, missing, malformed email validation | Chromium/Firefox/WebKit | desktop | Pass | — |
| `#/login` | Unknown email vs wrong-password disclosure | Chromium/Firefox/WebKit | desktop | Pass | — |
| `#/login` | Enter submission, masked password, URL secrecy, refresh | Chromium/Firefox/WebKit | desktop | Pass | — |
| `#/login` | Back after login | Chromium | desktop | Intermittent fail | LH-AUTH-001 |
| `#/login` | Rapid double-click | Chromium | desktop | Fail | LH-AUTH-002 |
| `#/login` | Rapid double-click | Firefox | desktop | Pass | — |
| `#/login` | Rapid double-click | WebKit | desktop | Intermittent fail | LH-AUTH-002 |
| `#/login` | Email casing and surrounding whitespace | Chromium/Firefox/WebKit | desktop | Pass | — |
| Authenticated `#/login` | Anonymous-route redirect | Chromium/Firefox/WebKit | desktop | Fail | LH-AUTH-001 |
| Dashboard | UI navigation, refresh, direct hash URL, active state | Chromium/Firefox/WebKit | desktop | Pass | — |
| Habits | UI navigation, refresh, direct hash URL, active state | Chromium/Firefox/WebKit | desktop | Pass | — |
| Progress | UI navigation, refresh, direct hash URL, active state | Chromium/Firefox/WebKit | desktop | Pass | — |
| Achievements | UI navigation, loading completion, progress labels | Chromium/Firefox/WebKit | desktop | Pass | — |
| Analytics | UI navigation, summary/trend loading | Chromium/Firefox/WebKit | desktop | Pass | — |
| Browser history | Habits → Progress → Back/Forward | Chromium/Firefox/WebKit | desktop | Pass | — |
| Authorization | Logout, Back/direct protected routes, refresh | Chromium/Firefox/WebKit | desktop | Pass | — |
| Authorization/API | Storage cleared and logged-out `/habits` rejected | Chromium/Firefox/WebKit | desktop | Pass (401 expected) | — |
| Habits lifecycle | Create, trim, punctuation/accent/emoji, edit, complete, refresh, archive | Chromium/Firefox/WebKit | desktop | Pass in prior mutating pass | — |
| Habit validation | Empty title | Chromium | desktop | Pass | — |
| Habit validation | 141/1001-character overlength values | Chromium/Firefox/WebKit | desktop | Fail | LH-HABIT-003 |
| Progress | XP awarded once, refresh persistence, same-day completion | Chromium/Firefox/WebKit | desktop | Pass | — |
| Account | Email/name display, refresh and re-login persistence | Chromium/Firefox/WebKit | desktop | Pass | — |
| Notifications | Open, empty state, Escape close/focus restore | Manual browser | desktop | Pass with focus issue | LH-A11Y-005 |
| Login responsive | Overflow and visible submit | Chromium/Firefox/WebKit | all 8 required sizes | Pass | — |
| Dashboard/Habits/Progress responsive | Overflow and usable content | Chromium/Firefox/WebKit | all 8 required sizes | Pass | — |
| Header | Logout/language vertical center delta ≤4 px | Chromium/Firefox/WebKit | all 8 required sizes | Pass | — |
| Accessibility | Labels, error associations, headings, landmarks, progress names | Chromium/Firefox/WebKit | desktop | Pass | — |
| Accessibility | 200% equivalent zoom/no horizontal overflow | Chromium/Firefox/WebKit | 640×568 at 2× | Pass | — |
| Hero terminology | Visible product-owned copy across routes | Manual + source audit | desktop/mobile | Pass | one user-data occurrence |

## 4. Terminology audit

No product-owned, user-facing occurrence of “Hero,” “Hero Profile,” “Become a Hero,” “Hero name,” or “Hero statistics” was found on Login, Dashboard, Habits, Progress, Achievements, Analytics, Notifications, or the tested validation states.

| Route | Exact wording | Type | Recommendation | Evidence |
|---|---|---|---|---|
| `#/habits` Archived | “Disposable quest created during authenticated smoke review. Edited successfully.” | Pre-existing user-authored habit description, not product copy | Do not automatically rewrite user content. If this is fixture/demo content, change “quest” to “habit” at its source. | `LH-HABIT-001-archived-e2e-records.png` |

Code-only legacy identifiers remain (`PERSISTED_QUEST_*`, `PROTOTYPE_QUESTS`, and translation keys named `auth.heroBefore/heroHighlight/heroAfter`), but their displayed English/French values use habit/personal-growth wording. They are not counted as user-facing defects.

## 5. Visual consistency audit

- Header controls: desktop controls measured approximately 44 px high and shared a 9 px top position. Mobile controls wrapped without horizontal overflow.
- Logout alignment: Passed all required widths. At 390×844, Logout aligns with the language selector and notification bell on the second header row. Evidence: `LH-NAV-001-logout-alignment-390x844.png`.
- Buttons: Primary, outline, archive/destructive, segmented filters, and disabled actions were visually distinguishable and consistently sized. Archive is visibly destructive.
- Navigation spacing: Readable at all tested widths. At 320–390 px the full navigation wraps to multiple rows rather than using a menu; usable, though vertically expensive.
- Responsive layout: No measured horizontal overflow; cards stack cleanly, text is not clipped, and forms remain reachable.
- Background readability: White cards and the dark hero/progress panels maintain readable separation over the illustrated backgrounds in the inspected screenshots.
- Typography/components: Heading hierarchy, card radius/shadow, input spacing, and badge styling were consistent. No Logout baseline shift was found.
- Confirmed visual defect: authenticated login form combined with authenticated navigation (LH-AUTH-001).

## 6. Accessibility report

Confirmed automated passes:

- Login labels resolve uniquely; password remains `type=password`.
- Invalid login inputs receive `aria-invalid` and `aria-describedby`.
- One main landmark, named primary navigation, one page-level heading, active `aria-current`, and named progress bars were present.
- Visible keyboard focus indicator check passed.
- 200% equivalent zoom retained content and avoided horizontal overflow.
- Progress and achievement indicators expose accessible labels.

Confirmed manual findings:

- Enter submits login.
- Escape closes Notifications and restores focus to the trigger.
- Notification dialog does not initially move focus inside (LH-A11Y-005; likely WCAG 2.4.3 Focus Order / APG dialog behavior).
- Habit overlength feedback is inaccurate/missing and not programmatically identified (LH-HABIT-003; WCAG 3.3.1 Error Identification and 3.3.3 Error Suggestion).

Potential findings requiring assistive-technology verification:

- Notification dialog announcement and focus expectations with NVDA/JAWS/VoiceOver.
- Toast/live-region announcement timing after habit completion and save.
- Full contrast audit over background imagery; visual inspection passed, but Axe/contrast instrumentation was unavailable.
- Reduced-motion behavior; no disruptive animation was observed, but OS-level reduced-motion output was not independently verified.

## 7. API, console, storage, and automated results

Network review:

- Captured authenticated GETs to `/health`, `/auth/me`, `/habits`, `/achievements`, `/analytics/summary`, `/notifications`, and `/notifications/unread-count` returned 200 when allowed to complete.
- Typical warm response times were 51–280 ms; login was 655–1,051 ms. No cold-start delay occurred.
- Chromium rapid double-click produced two 200 login responses (LH-AUTH-002).
- Logged-out `GET /api/habits` returned 401 as expected.
- Rapid test-driven route changes aborted superseded notification/analytics requests with `net::ERR_ABORTED`; these were navigation cancellations, not server failures.
- No CORS, mixed-content, malformed-content-type, unexpected 4xx/5xx, or sensitive query-string issue was observed.
- No bearer header was sent to unrelated origins in inspected code/tests.

Console review:

- In-app browser final error/warning log: empty.
- The only automated console error was the browser’s expected failed-resource message for the deliberate logged-out 401 check.
- No token, password, stack trace, or user record was logged.

Storage review:

- Local storage key `levelhabit.auth.v1` exists while authenticated and is removed on logout.
- It contains both access and refresh token fields (LH-SEC-004); values were never read into output.
- No application cookies were required for the current token architecture.

Commands (credential values supplied via environment and omitted here):

```powershell
npm run e2e:production -- --retries=0
playwright test --config playwright.production.config.ts --project=chromium --reporter=list,json --grep "rapid double click|opens, refreshes|clears stored"
playwright test --config playwright.production.config.ts --project=chromium --reporter=list --grep "overlength title and description"
```

Results:

- Final corrected three-browser run: 47 passed, 7 failed, 3 skipped, 0 Playwright-retry flakies, duration 2.8 minutes.
- Earlier mutating lifecycle pass: lifecycle passed in Chromium, Firefox, and WebKit.
- Browser-specific failures: Chromium duplicate login; WebKit duplicate login occurred intermittently in an earlier complete run. Authenticated direct login routing and habit overlength validation failed in all three browsers.
- HTML report: `frontend/playwright-report/production-audit/index.html`
- Final JSON: `frontend/test-results/production-audit/results.json`
- Sanitized network JSON: `frontend/test-results/production-audit/network-results.json`
- Evidence: `frontend/test-results/production-audit/evidence/`
- Trace/video: intentionally disabled because production authentication traces/videos can retain entered passwords or bearer tokens. Failure screenshots and sanitized event attachments were used instead.

Archived records that could not be deleted/restored because no cleanup action exists:

- `E2E-CODEX-1784133820314 Café's 🚀 edited`
- `E2E-CODEX-1784134065201 Café's 🚀 edited`
- `E2E-CODEX-1784134151677 Café's 🚀 edited`
- `E2E-CODEX-1784134264548 Café's 🚀 edited`

All four are archived and were the only records modified by this review.

## 8. Recommended remediation order

1. Security/authorization: Move refresh tokens out of local storage; preserve strict API-origin token attachment and logout revocation.
2. Broken core workflow: Add anonymous-only guards and replace login history so authenticated users cannot render the sign-in page.
3. Data/session integrity: Make login submission synchronously single-flight in Chromium and confirm backend session-token rotation semantics.
4. Validation/data integrity: Add accurate max-length messages and accessible invalid-state wiring for title and description.
5. Mobile usability: Keep the passing responsive behavior, but consider a compact mobile navigation pattern to reduce the multi-row header height.
6. Accessibility: Resolve notification dialog focus semantics, then verify with real screen readers and Axe/contrast tooling.
7. Terminology/visual polish: Remove legacy `Hero`/`Quest` identifiers from internal code opportunistically; do not rewrite user-authored content. Clarify same-day archived completion wording.
8. Test maintainability: Keep the production suite separate, run non-mutating coverage on pull requests, and gate mutating lifecycle tests behind an explicit environment flag/account cleanup strategy.

## Verdict

LevelHabit is **functionally strong and visually portfolio-presentable, but not yet polished enough for an unqualified portfolio launch**. The five highest-priority improvements are: secure refresh-token storage, authenticated anonymous-route guards, single-flight login submission, accurate accessible habit length validation, and notification-dialog focus semantics.

## 9. Remediation status (2026-07-15)

Status: **Implemented and locally verified; production verification pending deployment.**

| Finding | Remediation |
|---|---|
| LH-AUTH-001 | Added a functional anonymous-only guard to `/login` and `/register`. It restores an HttpOnly-cookie session before route activation and redirects authenticated navigation or full-page loads to Dashboard without creating the anonymous component. |
| LH-AUTH-002 | Added a synchronous `pending()` single-flight check at the beginning of login submission. The existing loading label, `aria-busy`, and disabled state now accompany component-level duplicate protection for clicks and Enter submissions. |
| LH-HABIT-003 | Confirmed the backend/domain/database limits of 140 title characters and 1000 description characters. Create and edit now show distinct required/maximum messages with `aria-invalid` and field-specific `aria-describedby` associations, block invalid saves, and recover after correction. |
| LH-SEC-004 | Refresh tokens now use a rotating `Secure`, `HttpOnly`, `SameSite=None` API cookie in production and are excluded from login/refresh JSON. Access tokens are memory-only. Refresh/logout use credentialed requests and a double-submit CSRF cookie/header. Explicit-origin CORS now allows credentials. |
| LH-A11Y-005 | Replaced the custom dialog-like panel with a native modal dialog, meaningful initial Close focus, modal background inertness, Escape close, explicit Tab-boundary containment, an accessible name, and trigger-focus restoration. |

Regression coverage added:

- Angular unit tests: anonymous navigation and refresh for login/registration;
  login rapid click/Enter single-flight and failed-request recovery; create/edit
  habit boundaries and accessible associations; cookie refresh/logout/storage;
  access-token retry; and notification focus behavior.
- ASP.NET Core tests: refresh-token JSON exclusion; production cookie flags;
  CSRF acceptance/rejection; cookie expiry; and the existing rotation/reuse
  rejection tests.
- Playwright: an isolated three-browser remediation suite plus updated
  production tests for the same scenarios. The isolated suite passed 15/15
  across Chromium, Firefox, and WebKit with no retries.

Local verification totals:

- Angular unit tests: 129 passed, 0 failed, 0 skipped.
- ASP.NET Core tests: 103 passed, 0 failed, 0 skipped.
- Isolated Playwright remediation matrix: 15 passed, 0 failed, 0 skipped,
  0 flaky or retry-only passes.
- Angular production build: passed.
- ASP.NET Core Release build: passed with 0 warnings and 0 errors.
- Updated production Playwright matrix: 69 tests collected successfully;
  execution remains pending the coordinated backend/frontend deployment and
  availability of the authorized production test account.

The original production result (47 passed, 7 failed, 3 skipped) remains the
deployment baseline. The updated 69-case production matrix has been compiled
but cannot be truthfully rerun against the old deployment: the new backend must
be deployed before the new frontend, and production E2E credentials were not
available in the remediation environment.

Observations and follow-up:

- LH-PROG-006 remains unchanged because whether same-day archived completions
  belong in “today” is a product decision, not a confirmed defect.
- LH-PROFILE-007 remains unchanged because editable profile behavior is outside
  current requirements.
- Restore or permanent deletion of archived habits was not introduced. The
  four `E2E-CODEX-` records remain archived; adding a production cleanup-only
  endpoint would be inappropriate. The new validation browser test mocks its
  save responses and creates no production records.
- After deployment, rerun `npm run e2e:production` with the authorized test
  account, first non-mutating and then with destructive lifecycle coverage only
  in an isolated test environment or with an approved cleanup strategy.
