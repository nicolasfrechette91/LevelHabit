# LevelHabit Angular Frontend Review

Review date: 2026-06-17

Checklist source: `frontend/docs/best-practices.md`. The prompt referenced
`docs/angular-best-practices.md`, but that path was not present in the local
workspace.

## Areas Reviewed

- TypeScript strictness, typed mock data, and avoidance of `any`.
- Standalone component metadata and Angular 21 compatibility.
- Route organization, route metadata, and feature lazy loading.
- Signal-based local state, `computed()` derived state, and unnecessary RxJS.
- Service boundaries for mock data and future API integration.
- Template readability, native Angular control flow, and class bindings.
- Static image handling with Angular image tooling.
- SCSS organization, Bootstrap utility usage, and component style budgets.
- Accessibility basics for navigation, button state, live updates, and focus.
- Existing frontend tests and GitHub Pages production build compatibility.

## Issues Found

- Prototype routes eagerly imported the same page component for every view.
- Route labels, page titles, and view copy were spread across multiple files.
- Prototype model types were declared inside the state service, coupling mock
  data imports to service internals.
- Persisted `localStorage` JSON was asserted directly as app state instead of
  being parsed from `unknown` and validated.
- `standalone: true` was still explicitly set in component decorators even
  though Angular 21 supports standalone-by-default components.
- The app shell static SVG used a plain `src` image instead of `NgOptimizedImage`.
- A dynamic interpolated class was used for quest accent classes.
- The custom quest toggle button had state text for screen readers but no
  explicit pressed state or custom focus-visible treatment.
- The production build briefly exposed an `anyComponentStyle` budget warning
  after the focus style was added.

## Improvements Made

- Enabled `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` in
  `frontend/tsconfig.json`.
- Added `levelhabit.models.ts` for shared prototype/domain types.
- Kept mock data in the state area and typed constants with `satisfies`.
- Hardened `LevelHabitStateService` by parsing stored JSON as `unknown`, using
  type guards, cloning default state arrays, and validating quest IDs/titles.
- Added `prototype-view.model.ts` to centralize prototype route metadata, view
  copy, and route-data validation.
- Converted feature routes to `loadComponent` lazy routes while preserving hash
  routing and `/LevelHabit/` build compatibility.
- Derived nav items from route metadata instead of duplicating route labels.
- Removed explicit `standalone: true` from Angular component decorators.
- Used `NgOptimizedImage` for the LevelHabit mark.
- Moved repeated template derivations into `computed()` values for achievement
  preview and top quest handling.
- Replaced dynamic quest accent class interpolation with explicit class
  bindings.
- Improved navigation accessibility with `ariaCurrentWhenActive="page"` and a
  properly labeled `nav`.
- Added `aria-pressed` and `:focus-visible` styling to quest toggle buttons.
- Added `aria-live="polite"` to the filtered quest count.
- Reduced equivalent mobile segmented-control SCSS so the production component
  style budget is warning-free.

## Intentionally Left For Later

- The prototype page is still one large feature component. It is acceptable for
  the current prototype, but the next feature pass should split repeated panels
  into focused child components when behavior stabilizes.
- No backend/API integration was added. Mock data remains local and service-led
  as requested.
- No new state management library was added. Signals remain enough for this
  frontend state.
- No Tailwind or Bootstrap removal was attempted.
- No visual redesign was attempted beyond small accessibility and SCSS cleanup.
- No AXE automation was added in this pass; only code-level accessibility basics
  were reviewed and improved.

## Angular Version Notes

- Angular 21 supports omitting `standalone: true`, so that guide rule was
  applied.
- Angular v22+ `@Service` was not applied. Angular 21 still uses
  `@Injectable({ providedIn: 'root' })`.
- Angular v22+ Signal Forms were not applied because this prototype has no forms
  and Signal Forms are listed by the guide as stable in v22+.
- The guide says not to explicitly set `ChangeDetectionStrategy.OnPush` because
  OnPush becomes the default in Angular v22+. This project does not set it
  explicitly, and no Angular 21-incompatible change was forced.
- `input()` and `output()` were reviewed but not applied because the current
  components do not expose inputs or outputs.

## Validation Commands

The normal `npm` PowerShell wrapper failed in this local environment because it
resolved to a missing roaming npm CLI. Validation was run through the installed
Node/npm CLI directly.

- `& 'C:\Program Files\nodejs\node.exe' 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' test`
  - Final result: passed, 3 test files and 12 tests.
- `& 'C:\Program Files\nodejs\node.exe' 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' run build -- --base-href /LevelHabit/`
  - Final result: passed, production build emitted to `frontend/dist/levelhabit`.
  - Confirmed lazy chunk: `prototype-page-component`.
  - Confirmed GitHub Pages base href: `/LevelHabit/`.
