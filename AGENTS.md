# Architecture rules

- Website product screenshots use locale-specific immutable asset pointers and labeled fictional demonstration records, never live company data, so presentations remain populated without exposing private information or altering company records.
- Normalize server-signed storage URLs with fixStorageUrl at browser consumption points, including cached kiosk media and print images, because VPS signing may return an internal origin.
- Passport OCR resolves credentials only on the server and prioritizes configured OpenAI credentials by default; explicit provider overrides remain supported so hosted and VPS deployments can select their provider securely.
- VPS scan-credit RPC repair is transactional and server-only, invoked by the migration sync script; preserve balances and lock the company row to prevent concurrent overspending.
- Project listings resolve company identity with the authenticated client and always scope roots/blocks to that company; optional statistics and image failures cannot hide projects, and unavailable statistics are not shown as zero.
- Company AI tools use authenticated owner checks, explicit tenant-scoped queries and an allowlisted module registry; AI writes require durable user-bound confirmation, while apartment batches apply atomically without changing sale snapshots.
- AI service errors share a safe code-based classifier across chat, transcription and scanners; quota/rate-limit denials stop app retries and preserve user input because provider limits are separate from ERP credits and raw error bodies may contain private data.
