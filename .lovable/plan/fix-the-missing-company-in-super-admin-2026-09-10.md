# Fix the missing company in Super Admin

## What will change
- Add the missing Super Admin database access rules to the safe VPS schema-sync script.
- Ensure an authenticated Super Admin can read all companies while ordinary users remain limited to their own company.
- Make the Companies tab report a real loading/read error instead of silently displaying `Компании (0)`.

## Technical details
- Recreate the idempotent `is_platform_admin` helper and required grants without deleting data.
- Enable and add narrowly scoped row-security policies only when absent.
- Keep the existing migrated company and all related data unchanged.
- Verify the app build and provide the exact safe VPS commands to apply the correction.
