# Quad mobile

A React Native + Expo companion to the Quad web demo, in the same repository.

## Try it on a phone

Requires Node.js 22.13+ and an Expo Go version compatible with **Expo SDK 57**.

```sh
cd apps/mobile
npm ci
npm start
```

Keep your computer and phone on the same Wi-Fi, then scan the terminal QR code using Expo Go on Android or the Camera app on iPhone. If the network blocks communication between devices, use `npm start -- --tunnel`; Expo may ask to install its tunnel helper. The computer must stay on while using the development preview.

For setup details, see [Expo's device guide](https://docs.expo.dev/get-started/set-up-your-environment/).

## Browser preview

```sh
npm run web
```

Open the URL printed by Expo, normally `http://localhost:8081`. This uses the same React Native screens and saved-state behavior, with an illustrated map. The iOS and Android apps use `react-native-maps`: Apple Maps by default on iOS and Google Maps on Android. Map tiles need internet access. Expo Go includes the native map module; standalone Android/store builds need separate Google Maps key configuration.

## What works

- Map, Connections, and Profile tabs with safe-area handling.
- Fictional Rutgers students on a native map, with profile-picture markers.
- Search, shared-interest, organization, and connection filters.
- Explicit similarity explanations, full profiles, and optional experience.
- Send, withdraw, accept, decline, and remove connection requests.
- Editable name, major, graduation year, bio, interests, organizations, and experience.
- Independent audience and duration choices, Ghost Mode, and presence freshness.
- Blocking, unblocking, and private local reports.
- Device-local persistence through AsyncStorage, including reload/restart.
- Nine tests for relationships, privacy transitions, matching, profile validation, and saved state.

## Important demo boundaries

All students are fictional. Authentication and university verification are simulated. No device location permission is requested. Visibility uses a fictional campus position and pauses after 15 minutes without a new update, even when set to Always enabled; save visibility again to refresh it.

This app does not call the existing Node/SQLite backend. Its state is independent of the web app and other phones. No request or report is sent to a real person or review team. Social-link editing, profile-photo uploads, classes, Close Friends, automatic proximity clustering, and custom visibility deadlines are deferred. The first screen explicitly opens a demo, not a real student account.

AsyncStorage is unencrypted demo storage. Before accepting real users, replace local relationship/report changes with an authenticated shared API, add university verification, enforce discovery permissions on the server, and add secure credential storage and real moderation. Follow `docs/production-next-steps.md` at the repository root.

## Validation

```sh
npm run typecheck
npm test
npm run export
# All three:
npm run check
npx expo-doctor
```

Export compiles browser JavaScript and native iOS/Android Hermes bundles. It does not create an APK/IPA, publish to an app store, or prove a physical-device run. A real phone/emulator check is still required. Simulator testing also requires Xcode or Android Studio, which this project does not install.

`npm audit` currently flags inherited Expo/Metro/Xcode-tool dependencies for which compatible patched versions are not available. Compatible fixes were applied; do not run `npm audit fix --force`, which currently suggests an unsupported Expo downgrade. Recheck upstream advisories before production release. Expo's version-compatibility checks pass.

## Repository layout

The original web app remains at the root (`src/`, `server/`, `public/`). Mobile has its own `package.json`, lockfile, and React version under `apps/mobile`; install its dependencies separately. There is no shared npm workspace yet. This keeps mobile SDK upgrades from changing the web app's dependencies.

## Next milestone

Connect both clients to one protected backend, add real verified university accounts, then test permission-controlled location sharing across at least two physical devices.

## Chats and campus gatherings

Accepted connections can open a chat from Connections or a full profile. Composed messages persist on the device. Sample incoming messages are labeled; this demo never delivers messages to another phone or fabricates automatic replies. Pending, removed, and blocked connections cannot send messages. Older saved demo state loads without losing profile or connection edits.

Map groups show explicitly assigned sample gatherings with a student count, venue, activity description, and attendee profiles. Browser hover and keyboard focus reveal a preview; phone taps open the same gathering details. Counts and names are generated from already-filtered discovery results, so blocked or filtered-out people are omitted. Groups with a single visible person fall back to an individual pin. These are curated demo groups, not GPS-derived attendance or live university events. Real gatherings will require explicit student check-ins and server-enforced visibility.
