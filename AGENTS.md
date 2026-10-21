# Architecture rules

- Website product screenshots use locale-specific immutable asset pointers and labeled fictional demonstration records, never live company data, so presentations remain populated without exposing private information or altering company records.
- Normalize server-signed storage URLs with fixStorageUrl at browser consumption points, including cached kiosk media and print images, because VPS signing may return an internal origin.