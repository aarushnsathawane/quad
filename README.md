# Quad

Rutgers campus discovery, connections, chats, and **Pregame by Quad** for public linkups and private invitations. The Expo app runs on iOS, Android, and the web, with Rutgers colors and light/dark appearance.

## Production implementation

The current app uses a shared authenticated API by default. The old fictional demo remains available only through explicit demo commands. The production server never exposes its shared demo-login endpoint, and production web builds force demo mode off.

- Rutgers email-code sign-in; single-use, time-limited codes and durable revocable sessions.
- Basic onboarding, editable profiles and illustrated avatars, interests, clubs, and experience.
- Server-enforced campus discovery, approximate foreground presence, freshness expiry, and Ghost Mode.
- Connection requests, accepted-connection chat with pagination and idempotent sends, bidirectional blocking.
- Public and invite-only Pregame events, connection invitations, RSVPs, cancellation, and event reports.
- Protected moderation queue with suspension, report review, event cancellation, and generic email alerts.
- Account export/deletion, privacy and community-policy pages, bounded data retention.
- Versioned SQLite migrations, persistent disk, encrypted S3-compatible offsite backups and tested restoration.
- Same-origin production web/API, secure HTTP-only browser cookies, native SecureStore tokens, validation, origin checks, rate limits, and security headers.

**Code readiness does not mean a live service exists.** The operator still needs hosting, a verified email sender, backup storage, a support address and a Rutgers moderator account. Native distribution additionally needs Expo/EAS and platform signing credentials. See [deployment instructions](docs/deployment.md) for exact steps, environment values and remaining real-service checks.

## Local production-style web app

Node.js 22.19+ and npm are required.

```sh
npm ci
npm ci --prefix apps/mobile
cp .env.example .env
# Configure an SMTP service and sender in .env before testing email sign-in.
npm run build
npm run dev
```

Open http://localhost:8080. `npm run dev` loads `.env`; `npm start` expects the hosting environment to supply variables. Without SMTP, sign-in fails closed rather than granting a demo identity. The real database defaults to `data/production.sqlite`, separate from all demo data.

## Native app

```sh
cd apps/mobile
npm ci
# In .env, set EXPO_PUBLIC_API_URL to your deployed HTTPS API origin.
npx expo start --go
```

For an actual release, use the EAS profiles in `apps/mobile/eas.json`. The native build validates the API URL and requires an Android maps key for Android. Browser production builds use the same origin as the API and require no client API URL. Details and outstanding store setup are in [deployment instructions](docs/deployment.md).

## Explicit fictional demos

```sh
# Native/browser Expo demo with independent device-local data:
npm --prefix apps/mobile run demo
# Original legacy web demo, intentionally bound to loopback:
npm run demo:web
```

Demo accounts, fixtures, local reports and chats are not migrated into production accounts. The legacy `server/` and `src/` web prototype is retained for reference; the Docker image runs `backend/index.mjs` and serves the current Expo web app.

## Verify

```sh
npm run check
npm --prefix apps/mobile run export:production
npm audit --audit-level=moderate
npm audit --prefix apps/mobile --audit-level=moderate
```

`npm run check` runs backend security/data tests, legacy regressions, mobile logic tests, TypeScript checks and the production web build. CI also exports native JavaScript and builds/smokes the production Docker image. JavaScript exports are not signed native app binaries or real-device tests.

## Architecture and limits

One Node/Fastify service serves the web app and API. SQLite uses WAL, foreign keys, transactions and versioned migrations. It is a deliberate single-instance campus-pilot design: use a persistent disk, never an ephemeral/serverless filesystem or multiple replicas. Move to managed PostgreSQL before horizontal scaling. Discovery returns at most 500 eligible profiles; accounts support up to 500 relationships. Polling updates profiles/events every 10 seconds and an open chat every 5 seconds; it is not a background tracking service. Only latest coarse presence is stored, not raw GPS or location history.

Profile photos/uploads, push notifications, app-store submission, real-device validation and enrollment-system integration are not implemented. A verified school inbox is proof of mailbox control, not verified identity or current enrollment. The operator must review the policies, staff moderation, monitor backups, and run the real-service launch checks before inviting students.

See [data model](docs/data-model.md), [API reference](docs/api.md), [deployment/runbook](docs/deployment.md), and [validation results](docs/readiness.md).
