# Restore directors and partner distribution visibility

## Goal
Show the two existing directors and their 70%/30% project shares on the VPS deployment without changing or re-importing any records.

## Changes
- Correct the director lookup so an account that is both company owner and Super Admin uses its owned company instead of receiving an intentionally empty list.
- Keep pure Super Admin access isolated from another company’s records.
- Show a clear retryable error on the Directors page instead of presenting a failed request as “no directors.”
- Verify that the same corrected lookup feeds the project income-distribution panel.

## Validation
- Confirm the Directors page returns the two existing records for an owner who is also Super Admin.
- Confirm the project panel reads the existing partner shares and distributions without schema or data changes.
- Check the app build and relevant error logs.

## Technical details
The current server function checks `platform_admins` before company ownership and immediately returns an empty director list for any Super Admin. The lookup will prioritize a directly owned company, preserving the current behavior for platform-only administrators.
