# E2E Tests — NOVAX Ops

Playwright tests covering 10 critical user flows.

## Setup

1. Set environment variables (or create a `.env.test` file):

```
TEST_USER_EMAIL=your-test-account@example.com
TEST_USER_PASSWORD=your-test-password
TEST_BASE_URL=http://localhost:3000   # optional, defaults to localhost:3000
```

Use a **test account**, not your production admin account. The test user should have admin or full access so all pages are reachable.

2. Start the dev server in a separate terminal:

```bash
npm run dev
```

3. Run all E2E tests:

```bash
npm run test:e2e
```

## Commands

| Command | Description |
|---|---|
| `npm run test:e2e` | Run all tests headlessly |
| `npm run test:e2e:ui` | Open Playwright UI (interactive mode) |
| `npm run test:e2e:report` | Open the last HTML report |

To run a single file:
```bash
npx playwright test e2e/03-pipeline.test.ts
```

## Test files

| File | Flow |
|---|---|
| `01-login.test.ts` | Login page, auth redirect, bad credentials |
| `02-dashboard.test.ts` | Dashboard load, sidebar, nav |
| `03-pipeline.test.ts` | Kanban board, new task dialog |
| `04-clients.test.ts` | Clients page, wizard, URL deep-link |
| `05-publishing.test.ts` | Publishing grid, compose, calendar toggle |
| `06-approval.test.ts` | Approval page, public portal graceful error |
| `07-studio.test.ts` | Studio hub, Hook Lab, Content Studio |
| `08-assistant.test.ts` | AI Assistant page and input |
| `09-settings.test.ts` | Settings page, team tab, invite button |
| `10-security.test.ts` | Unauthenticated redirects + API 401s |

## Auth state

On first run, `global.setup.ts` logs in once and saves the session to `e2e/.auth/user.json`. This file is gitignored. Subsequent test runs reuse the saved session — no repeated logins.

## Important notes

- Tests use a real running dev server and real Supabase — they are not mocked.
- Tests do not write permanent data (they open dialogs but do not submit forms).
- The security tests (`10-security.test.ts`) run unauthenticated and verify both page redirects and API 401s.
- `workers: 1` in the config keeps tests serial to avoid race conditions on shared DB state.
