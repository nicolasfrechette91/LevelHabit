# Screenshot Capture Guide

Use this guide when capturing real LevelHabit screenshots for the GitHub README,
portfolio pages, or interview materials. Do not generate placeholder or mock
screenshots; capture the deployed application with a demo account and safe
sample data.

## Source

- Production frontend: `https://nicolasfrechette91.github.io/LevelHabit/`
- Production API health check:
  `https://level-habit-api.onrender.com/api/health`

If the Render API is cold, open the app and wait for the first health request to
finish before capturing authenticated screens.

## Recommended Viewports

- Desktop: `1440 x 1000` or `1440 x 900`.
- Mobile: `390 x 844` for a modern phone-sized viewport.

Keep browser zoom at `100%`. Hide bookmarks bars, extension popups, developer
tools, password managers, and browser UI that could expose private data.

## Suggested Demo Data

Use a dedicated demo account with a non-personal email address and a password
that is never shown in screenshots.

Recommended sample state:

- At least three active quests across different categories.
- One quest completed today.
- A hero profile with visible XP and level progress.
- At least one unlocked achievement.
- Enough completion history for analytics cards or charts to show meaningful
  values.
- No real names, private emails, secrets, tokens, connection strings, or
  production admin data visible anywhere in the frame.

## Screens To Capture

| Screenshot | What to show | File name |
| --- | --- | --- |
| Login or register | Clean unauthenticated entry point | `docs/screenshots/login.png` |
| Dashboard | Hero progress, XP, streak, and next actions | `docs/screenshots/dashboard.png` |
| Quests | Active quests with at least one completed today | `docs/screenshots/quests.png` |
| Achievements | Achievement grid with at least one unlocked item | `docs/screenshots/achievements.png` |
| Analytics | Real completion and XP activity data | `docs/screenshots/analytics.png` |
| Mobile dashboard | Responsive dashboard or quests view | `docs/screenshots/mobile-dashboard.png` |

## Naming Convention

- Save screenshots as PNG files.
- Use lowercase kebab-case names.
- Store files under `docs/screenshots/`.
- Keep README paths stable so external portfolio links do not drift.

Expected paths:

```text
docs/screenshots/login.png
docs/screenshots/dashboard.png
docs/screenshots/quests.png
docs/screenshots/achievements.png
docs/screenshots/analytics.png
docs/screenshots/mobile-dashboard.png
```

## Privacy Checklist

Before committing screenshots:

1. Confirm no private email address, password, JWT, refresh token, API key,
   connection string, GitHub secret, deploy hook, or browser autofill value is
   visible.
2. Confirm the account and quest data are intentionally safe to show publicly.
3. Confirm the browser address bar does not include sensitive query parameters.
4. Confirm screenshots came from the production deployment, not local mockups.
5. Confirm the README uses the final committed file paths.
