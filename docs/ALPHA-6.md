# v3.7.0-alpha.6 — reusable updates through live v3.12.0

This experimental Starter adds the compact two-column repayment overview, readable receipt months/dates, tabbed forwarding ledgers and explicit statement verification. It retains configurable loan terms, grace days and private agreement text without any family document or preset financial figures.

Home / Overview places backup status and connection guardrails at the top. Task cards support user-selected accents, saved custom order, copying and monthly or annual recurrence after completion. Short months preserve the intended monthly day. Due-date warnings remain independent of custom colors. Disabled modules hide their tasks without deleting them.

Custom loan pages no longer repeat the loan title. Title/logo/color customization and module toggles remain available. Starter begins with an empty household; all business, inspection, loan and family modules are optional.

## Three distributions
- Starter ZIP: fresh portable Python installation; not the Windows installer.
- Starter Update ZIP: program-only update for an existing alpha Starter test copy, preserving data/settings.
- Repository and Windows ZIP: clean source plus manual GitHub Actions build workflow. It contains no compiled Setup.exe. Upload the contents of ctrl-ur-finances at repository root, preserving the folder structure, then run Build Windows installer.

Never apply a Starter update to the private live Expense Book. Your live v3.12.0 remains separate.

## Pilot checks
1. Update a Starter test copy; check version alpha.6, title, logo and modules.
2. Copy a task, give it a new date, set Monthly, complete it and verify the next date. Reload and check card order/color.
3. Enable Family Repayments and use synthetic terms/receipts. Check compact overview, forwarding allocations, statement verification and private agreement text. Confirm private notes/reference are absent from borrower snapshots.
4. Save/reopen, transfer, and backup/restore checks remain required for the installed Windows pilot.
5. Build on GitHub Actions or Windows x64, then install on the Windows 11 Home x64 test laptop. The bundled executable should not require Python on that laptop.

Source tests do not establish that the Windows installer has run successfully. The installer remains unsigned and experimental until the build and manual pilot pass.
