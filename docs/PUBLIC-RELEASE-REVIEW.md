# Public-release preparation — 2026-10-17

Candidate: **Ctrl Ur Finances v3.32.53-alpha.4**
Source: supplied v3.32.53-alpha.1 Repository ZIP, extracted into a separate working copy.
The private live Expense Book, SEO Genie and original Starter source were not modified.

## Packaged privacy boundary

The input source archive was inventoried and reviewed for runtime records, known
personal identifiers, private paths, email addresses, network addresses and token
patterns. No saved workbooks, household/customer records, uploaded logos/photos,
credentials or personal network paths were found in the candidate application
source. Loopback addresses and fictional test/example data are intentional.
Residual personal identifiers in old test assertions were removed. This review
is pattern-based plus targeted manual inspection, not proof that every possible
sensitive string is absent.

Distribution uses explicit source/runtime allowlists. ZIP checks reject workbooks,
known runtime data files, node_modules, .git and caches. The public sample is a
manual fictional-entry guide, not a data-bearing installation. Session and backup
bookkeeping patterns were added to .gitignore.

**Git history was not supplied or inspected.** The linked private GitHub repository
could not be read here. Publish these clean files through a new, empty repository;
do not transfer the old .git directory or infer that its history has been cleared.

## Focused code review

- Examined the local HTTP host/origin/session-token boundary and loopback binding.
- Examined React display paths and standalone HTML statement output. No own-source
  dangerouslySetInnerHTML, innerHTML assignment or document.write was found in the
  application source; bundled framework code is a separate dependency.
- Examined workbook size/macro checks and ZIP restore path/manifest boundaries.
- Examined RōM transfer previews, CSV exports, and image-input restrictions.
- Added tests for rejected unauthorized requests and unsafe recovery paths, malicious
  borrower text, quoted/multiline CSV, and formula-like CSV text.
- Fixed malformed quote escaping in the legacy annual CSV export. Made standalone
  repayment-statement encoding explicit, including displayed numeric terms.
- Reformatted own JavaScript/JSX/TypeScript and test modules for readable maintenance
  and scanning. Syntax trees were compared before/after formatting to check equivalence.

This was a focused source review and regression test effort, not a penetration
test or comprehensive vulnerability scan. No claim is made that the other private
applications have been reviewed or that all possible issues are absent.

## Licenses and dependencies

MIT candidate license uses Double Diamond Labs copyright, matching RōM's approach.
The owner should approve that choice before public release. Runtime React,
react-dom, scheduler, fflate and Lucide notices are included. Direct development-tool
license texts are included with the source; node_modules is not distributed.
Installed versions were checked against direct package pins. See DEPENDENCIES.md.

## Verification and remaining gates

The release verification log and LAST-VERIFIED.json record automated results.
Checks run against temporary synthetic data: reproducible frontend, financial and
feature regressions, fresh setup, module visibility, save/reload, backups/recovery,
program updates, and saved-data preservation. Actual ZIP checks are separate from
source tests and exercise the packaged updater.

Not performed here: native Windows/Excel/shared-drive pilot, full dependency advisory
audit, independent security audit, fresh online npm installation, or a follow-up GitHub CodeQL scan
on alpha.3. The owner-provided alpha.2 scan completed and reported 13 path-injection
alerts; the follow-up scan is pending. Run the Windows pilot and both CodeQL language analyses
before publishing downloadable release assets. Screenshots should be taken from
fictional data during that pilot; no private application screenshots are bundled.

## Follow-up to the first CodeQL scan

The owner supplied the 13-alert list and the full source-to-sink path for alert
13 (workbook linking). The listed locations were reviewed in local source. The
alerts include intentional external file selection, optimistic-lock path label
comparisons, ZIP extraction, and yearbook filename construction. Alert count is
not a count of demonstrated exploits; host/origin/token guards already existed.

Alpha.3 adds scoped native-chooser grants for external workbook/setup/recovery
paths, normalizes paths before enforcing the data-folder boundary, removes
filesystem resolution of revision-label inputs, uses a fixed yearbook filename
map, and explicitly checks restore-member containment. No scan exclusions,
alert dismissals, or security-rule suppressions were added.

The backup destination/reference selection and existing configured data/workbook
locations remain trusted local-app settings; the app is not an Internet-hosted
service or a sandbox against a malicious user of the same operating-system account.
Native chooser behavior and UNC paths need the owner Windows pilot.

## Alpha.4 follow-up

The owner-provided alpha.3 results show 12 closed and 14 open path-injection
alerts. The common helper compared a case-normalized alias and returned the
pre-comparison canonical value; the root-equality branch also returned that
request-derived value. Alpha.4 returns the trusted base in the equality case
and directly validates the canonical descendant value that it returns. This
keeps the checks explicit for both maintenance and static analysis. The public
CodeQL standard-library model was consulted to confirm its path-normalization
and startswith guard behavior. A new GitHub scan is still required.
