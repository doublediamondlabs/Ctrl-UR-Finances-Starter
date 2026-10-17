# v3.7.0-alpha.5 — reusable repayment and connection tools

Adds compact forwarding receipts/history/review tabs, partial receipt allocation to forwarding batches, and dated totals. Adds expected/received/catch-up summary and configurable grace periods. Adds private Agreement & reference text, with paste or TXT import (10,000 characters); users enter their own terms and forwarding recipient. PDF text can be pasted; PDF attachment storage is not included. Terms changes preview their effect before saving. No household-specific document, name, principal, payment schedule or grace period is supplied.

Workbook connections lock by default, require current/proposed-file confirmation, and relock automatically. Annual links, unlink, automatic year creation and family-ledger creation/linking are covered. Household onboarding remains its explicit Create household flow. These are accidental-change safeguards, not authentication.

Existing Starter data/settings are retained. The private live Expense Book release is a separate application; never apply this Starter patch there. Agreement/forwarding details stay out of borrower snapshots.

Portable Starter alpha.4 remains the last user-tested baseline. Alpha.5 adds new features and needs a short local check. Source automation passed; no Windows installer has yet been compiled or manually tested. The installer build kit now carries alpha.5 too; this replaces the earlier unbuilt rc.1 kit and does not claim a stable release.

## Local pilot
1. On the Starter test copy, update and confirm alpha.5; verify title/logo/modules remain.
2. Enable Family Repayments if needed; unlock link settings to create a sample ledger.
3. Save a sample agreement with a grace period; reload. Verify the reference stays private in the monthly snapshot.
4. Record sample receipts and forwarding; confirm held amount and history.
5. Open and cancel a connection review; confirm relocking.
6. Then build/test the Windows installer using START-HERE.txt in the build kit.
