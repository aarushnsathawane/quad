# Quad

**Your campus. Your people.** A map-first campus social discovery app.

This repository contains a runnable **local MVP demo** for Rutgers University. Explore fictional students, find shared interests and organizations, edit your profile, manage connection requests, and control visibility. Data is saved in SQLite on your computer.

> This is a functional prototype, not a campus-ready production service. University verification and the signed-in user are simulated. All map profiles are fictional; the illustrated campus map is not a geographic basemap. Do not deploy this demo server publicly or use it to collect real student data.

## Mobile app

The React Native + Expo mobile demo now lives in [`apps/mobile`](apps/mobile/README.md). It has native iOS/Android maps, the same core discovery flows, and independent device-local saved data.

```sh
cd apps/mobile
npm ci
npm start
```

Scan Expo’s QR code with Expo Go on a phone on the same Wi-Fi. Use `npm run web` in that folder for the browser preview. See the mobile README for SDK compatibility, validation, and demo boundaries.

## Run the original web app locally

Requires **Node.js 22.13+** and npm. Node 22's built-in SQLite module may print an experimental warning; this is expected.

```sh
npm ci
npm run dev
```

Open **http://localhost:5173** and click **Explore the Quad demo**. No API keys or external database are required.

For the optimized build:

```sh
npm run build
npm start
```

The server deliberately binds to `127.0.0.1` and accepts only local Host headers. Use `PORT=5174 npm run dev` if port 5173 is occupied. Development and production preview use the same database.

## What works

- Responsive Map, Connections, and Profile views.
- Pan/zoom campus illustration, student markers, and clustering.
- Search by name, major, interests, and organizations.
- Filters for shared interests, shared organizations, and accepted connections.
- Specific similarity explanations from organizations, mutuals, majors, and interests.
- Full profiles, optional experience, and validated Instagram/LinkedIn links.
- Profile editing with persistent interests and affiliations.
- Send, withdraw, accept, decline, and remove connections.
- Independent visibility audience and duration, including custom expiry.
- Ghost Mode removes stored presence; stale and expired locations disappear.
- Blocking removes connections and hides profiles in both directions.
- Private local reports and an unblock list.
- Nine integration tests covering privacy, state changes, and persistence.

The seed includes two existing connections and two incoming requests so every flow can be tried. Clicking a **Connected** button offers to remove that connection. Fictional students do not automatically accept outgoing requests.

## Demo boundaries

- The demo login is one shared fictional identity, **Alex Chen**. It is not authentication or email verification. Session cookies are HTTP-only, same-site, and expire after 24 hours; in-memory sessions are cleared on server restart.
- Fictional other-student positions are refreshed while the demo runs. The viewer's position is never silently refreshed.
- Saving visibility sets a fictional campus position. The UI never asks for or captures device GPS. An internal location endpoint exists for later integration, but is not a complete tracking system.
- Presence expires after 15 minutes without an update, even when sharing is set to Always. Save visibility again to refresh the fictional position.
- Discovery is limited to the sample College Avenue area, not distance from the user's actual device.
- The map uses an original local SVG illustration. Marker positions are quantized. This simple rounding is a demo approximation, not a complete defense against location inference.
- Profiles have illustrated avatars. Photo uploads, minor selection, separate hobby categorization, classes, and Close Friends are deferred.
- Reports are saved locally; there is no moderation dashboard, alerting, or staffed reviewer.
- Campus data and catalogs are seed fixtures, not authoritative university records.
- The app polls every 15 seconds. Production realtime revocation, permission changes, and browser background handling still need work.
- Fonts optionally load from Google Fonts with local system fallbacks. Avatars and maps require no external image services.

## Architecture

| Layer | Choice |
| --- | --- |
| UI | React + TypeScript |
| Map interaction | Leaflet + local campus SVG |
| Icons | Small local SVG components |
| Development/build | Vite |
| API | Node.js HTTP server |
| Storage | Node.js built-in SQLite |
| Tests | Node.js test runner |

The API and frontend use the same origin. No database or raw-coordinate access is exposed to the browser. Account records, profiles, and current location are separate tables. See [the data model](docs/data-model.md) and [schema](server/schema.sql).

```text
src/             React app, map, styles, API types
server/          API, database, seed data, server
public/          Local map illustration and student avatars
tests/           API and persistence integration tests
docs/            Data model and campus-launch checklist
```

## Verification

```sh
npm test
npm run build
# Or both:
npm run check
```

Tests use isolated databases and ephemeral loopback ports. They do not edit your demo database.

## Local data and GitHub

The database is created at `data/quad.sqlite`, which is ignored by Git. To start fresh, stop the server, move the `data` directory aside, and start again. `QUAD_DB` can point to another SQLite file. A `.env.example` documents supported variables; this server reads actual environment variables, not `.env` files automatically.

Source and the dependency lockfile belong in GitHub. Databases, sessions, build output, and secrets do not. GitHub Pages cannot run the SQLite backend; cloning and running locally is the supported preview for this version.

## Before a real campus launch

See [production next steps](docs/production-next-steps.md). The next milestone is real authentication and verified university membership, followed by protected multi-user discovery and an actual geographic basemap.
