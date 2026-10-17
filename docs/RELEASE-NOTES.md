# Ctrl Ur Finances v3.32.53-alpha.3 — file-access review

This candidate addresses the file-access locations flagged by the first public
CodeQL scan. A follow-up GitHub scan is required; no claim is made that alerts
are resolved until that scan finishes and the alert list is checked.

- External workbook, setup-folder and recovery-ZIP paths require selection through
  their existing native chooser. Session approvals apply to the exact selection
  and purpose. Existing linked workbooks and Use Last Successful Backup continue
  working after restart.
- Paths within the configured data folder remain directly usable. Normalized
  paths and resolved symlinks are checked against that boundary.
- Workbook revision checks compare path labels without opening request-supplied paths.
- Yearbook filenames come from a fixed valid-year table.
- Restore extraction checks each resolved destination stays in its temporary review
  folder, in addition to the existing ZIP-name, manifest and hash validation.
- No workbook format, financial calculations or saved-data migration changes.

**Small workflow change:** to use a new external workbook or recovery ZIP, select
it with Browse/Choose in the current session. Pasting its path alone no longer
approves external access. Initial setup can use the default folder immediately;
choose a custom empty folder using the existing chooser. Network shares remain
supported by the Windows chooser. If the chooser is unavailable, use the default
data location until it is working again. The owner Windows pilot is still needed.

Use the Starter Update ZIP for an existing supported Starter. This update is not
for the private live Expense Book. Exit before updating; saved data and links are
preserved. The fresh Starter ZIP is for a separate new installation.

---

# Ctrl Ur Finances v3.32.53-alpha.2 — public preview

The shareable Starter edition of Expense Book, prepared for a clean public source
repository. Household finances work independently; business and inspection tools,
family repayments, loan tracking, Move Planner and RōM exchange are optional and
start off on a fresh installation. Existing module preferences are preserved.

Includes visual Spending Mix comparisons, selected-category doughnuts, review
queues, cross-year search, local backups and optional retention.

This preparation adds public setup/support/security documentation, sample-entry
instructions, complete bundled scheduler notices, and readable application source.
CSV export now correctly quotes embedded quotation marks; repayment-statement
HTML escaping is explicit and consistent. No workbook schema migration is added.

Downloads: Starter ZIP for a new installation; Starter Update ZIP for an existing
Starter. Close the app on every computer and linked Excel files before updating.
The updater accepts 3.7.0-alpha.1 through alpha.6 and 3.32.3/7/16/36/37/40/53-alpha.1,
plus 3.32.53-alpha.2. It does not target the private live Expense Book.

Automated checks use synthetic data. Native Windows pilot and GitHub CodeQL remain
separate publication checks; see PUBLIC-RELEASE-REVIEW.md for exact scope.
MIT licensed. Personal project, maintained as time permits, without a support SLA.
