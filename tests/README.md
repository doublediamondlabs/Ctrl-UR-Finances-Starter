`python tests/test_logo_policy.py` verifies the HTTP image policy allows the local
blob URLs used by logo uploads without broadening script/network permissions.

# Synthetic checks

`python tests/test_storage.py` exercises fresh external-folder setup, preference
validation/concurrency, PNG storage, workbook byte preservation, backup/restore,
portable paths and nested-destination rejection. Its minimal workbook container is
created in memory for storage tests; it is not the household template.

`python tests/test_update.py` checks data backup hashes, settings/logo/workbook
preservation, simulated failed-update rollback, production-version rejection and
(on POSIX) rejection while the app lock is held. Native Windows lock behavior still
needs the Windows pilot.

`node tests/test_starter_ui.mjs` runs the bundled app against a temporary local
Python server using JSDOM. Install jsdom 30.1.1 as an uncommitted test dependency at the repository root
(`npm install --no-save jsdom@30.1.1`). Run npm install in app/Source for frontend
and feature-test dependencies. Set PYTHON if
the executable is not `python`. The test creates and removes only temporary data.
It verifies setup, household receipt/purchase save/reload, module dependencies,
simple business income save/reload, appearance settings, family-ledger retention,
and verified backup/isolated restore. All entries use synthetic labels.

These checks do not replace real browser visual testing, native folder-picker/logo
canvas checks, native Windows share behavior or Excel recalculation verification.

Pilot: create a new household; save one income, purchase and transfer; close and
reopen. Check totals, toggle modules, customize the title/logo, back up and inspect
an isolated restore. Keep the live installation independent throughout.

Alpha.5: node tests/test_family.mjs and python tests/test_link_guard.py cover forwarding, grace boundaries, privacy, and stale/missing connection review. Browser test additionally saves/reloads a private reference.

New release checks: node tests/test-dealer-flow.mjs, node tests/test-inspection-location.mjs, node tests/test-inspection-move.mjs, and python tests/test_destination_storage.py. These cover shared destinations, manual/private locations, inspection moves, save/reopen, atomic destination saves, rollback and stale-write protection.
