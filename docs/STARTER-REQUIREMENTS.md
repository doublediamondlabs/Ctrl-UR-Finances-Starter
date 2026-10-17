# Household starter requirements and status

## Original alpha.6 baseline (historical)

Current release: 3.32.53-alpha.1. See RELEASE-NOTES.md for cumulative upgrades.
- Fresh household setup: name, first year, explicit empty data folder.
- Blank annual workbook generated without financial entries or loan defaults.
- Editable generic household categories and income sources.
- Income, spending, transfers, reconciliation and summaries.
- Optional bundled Business, Inspections & Travel, Loan Tracking, Family Repayments.
- Inspections enables Business; disabling Business also hides Inspections.
- Disabled module records remain saved and included in backup.
- Custom title/tagline, PNG/JPEG logo converted to local PNG, accent presets/defaults.
- Separate program/data folders; pointer checked at startup.
- Backup/isolated restore and portable copy include external data and logo/settings.
- Experimental program-only updater with backup, active-process guard and rollback.
- Shared inspection-history transaction protections retained from v3.6.0.

## Stable-release gates still open
- Native Windows and share-drive pilot; real browser layout/accessibility review.
- Excel recalculation and end-to-end financial workflow checks on synthetic books.
- Reviewed dependency lockfile and project sharing/license terms.
- Production migration design/testing. Existing-layout recognition is present, but
  alpha.2 is a fresh-install pilot, not an authorized or tested production migration.
- Open-existing-data-folder onboarding; currently move a complete portable copy.
- Changing an established data folder through settings; use portable copy instead.

## Design constraints
A module toggle hides features, never deletes records. Permanent removal is separate.
One codebase carries household and business capabilities; no third-party plugin loader.
Local storage only, no cloud sync or simultaneous editing guarantee on network shares.
Retain discreet Double Diamond Labs credit, visible version and data location.
Use MAJOR.MINOR.PATCH-alpha.N for experiments; stable release only after acceptance.

## Deferred
Dark theme, additional bank formats/PDF import, multiple family repayment ledgers,
third-party plugins, cloud sync, bank APIs, automatic tax advice, declined-work CRM.
