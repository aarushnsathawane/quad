# Quad data model — implemented demo

The original brief remains the product direction. The schema in `server/schema.sql` is a small local implementation of the proposed relational model.

| Table | Purpose | Relationships and constraints |
| --- | --- | --- |
| universities | Campus identity and email-domain configuration | One university to many users, programs, organizations |
| users | Private identity, campus, verification and account status | Unique email; verification is simulated for seed users |
| academic_programs | Consistent major/minor names | University-scoped unique name |
| profiles | Public name, academic identity, bio, avatar, social links | One per user; major and optional minor references |
| tags | Curated interests and hobbies | Unique name |
| profile_tags | Student tag choices | Unique user/tag; interest or hobby kind |
| organizations | Campus clubs, teams, labs | University-scoped unique name |
| profile_organizations | Self-reported affiliation | Unique user/organization |
| experiences | Casual professional/project context | Many per profile; ordered |
| visibility_settings | Audience and expiry | One per user; university, connections, nobody |
| user_locations | Latest private location | At most one row per user; no movement history |
| connections | Pending requests and accepted relationships | Ordered unique user pair; initiator must be a participant |
| blocks | Directed block declarations | Unique non-self pair; enforcement is bidirectional |
| reports | Private abuse reports | Reporter and subject retained as nullable references |

## Derived values

Visibility, similarities, mutual connection counts, and request direction are calculated. They are not separate persistent records. Email and raw location do not appear in public profile responses.

The backend permits location discovery only when both accounts are active and verified at the same university, neither has blocked the other, the target audience permits the viewer, the sharing expiry is in the future or absent, and location freshness is under 15 minutes. The demo additionally scopes coordinates to College Avenue.

## Deliberate demo simplifications

- Authentication is a clearly labeled single-user demo session, never a production credential.
- Seed users have fictional email addresses and simulated verification timestamps.
- Profile photos use original illustrated avatars; no storage/upload service.
- A minor field and hobby kind exist in the schema, but the current editor combines interests/hobbies and omits minor selection.
- Experience kinds and academic major/minor eligibility flags are deferred in this demo.
- Single major and optional single minor; no enrollment records.
- Closest-user ranking, spatial indexes, geographic tiles, classes, and Close Friends are deferred.
- The demo uses bounded in-process relationship queries. Real campus scale needs batched joins and indexed spatial queries.
- Reports have a stored status, but no review interface.
- No migration framework yet: the initial schema is idempotent for an unchanged structure. Introduce versioned migrations before changing existing tables.

## Privacy limits

Simple coordinate rounding is not a complete privacy mechanism. A production design must address repeated queries, cell boundaries, timing, approximate-distance leakage, abuse limits, and revocation. The demo's synthetic map and users let the interaction be reviewed without exposing real students.
