# From working demo to a campus pilot

The current server is intentionally local-only. Do not publicly host the demo-login endpoint.

1. **Real identity.** Replace demo sessions with a maintained authentication provider; verify an approved university email before campus access. Do not trust client-supplied verification or university IDs. Account recovery, logout, deletion, and session invalidation need real flows.
2. **Production database.** Choose hosted PostgreSQL with geographic indexing for campus proximity. Add versioned migrations and backups. Preserve foreign keys and unique relationship constraints. Replace per-person queries with bounded batch queries.
3. **Real map.** Integrate a geographic basemap with attribution and an explicit key configuration. Use an approved precision policy, restricted map query area, result bounds, and abuse rate limits.
4. **Location consent.** Request OS permission only after a user chooses sharing, keep audience and duration independent, and distinguish OS permission from consent. Define background behavior, offline behavior, precision, and freshness. Expiry, Ghost Mode, and blocking must revoke cached and live presence promptly.
5. **Media and onboarding.** Add limited, validated profile-photo uploads and an accessible, skippable onboarding flow. Keep university email private.
6. **Safety operations.** Build a minimal protected moderation queue, report alerts, suspensions, data-retention rules, and account deletion. Avoid sensitive location logging.
7. **Deployment.** Run behind HTTPS with secure cookies, persistent sessions, strict authorization, CSRF protection, mutation rate limits, production error logging, and environment-specific secrets. Never ship demo identity shortcuts to the public service.
8. **Pilot verification.** Exercise at least two real accounts across universities, browser sessions, blocked pairs, audience changes, expired presence, and background tabs. Conduct mobile and assistive-technology checks. Use synthetic data until those controls are verified.

No feed, messaging, classes, Close Friends, or organization administration is required for the first campus pilot.
