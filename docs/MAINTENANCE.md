# Maintenance guide — Ctrl Ur Finances Starter

## Start here
Keep this source folder separate from the installed application and its data. Current release: **3.32.53-alpha.2**. The earlier baseline and its verification record remain in LAST-VERIFIED.json. Do not mix live and starter updates. The starter stays experimental even after automated verification.

The application runs locally with Python and a bundled browser interface. React source is compiled into app/web/app.js; Python serves it and handles workbook/settings writes. Normal use needs no npm download or hosted service. Development dependency installation needs internet access once; keep the lockfiles.

## Where things live

| Concern | Source |
|---|---|
| Navigation, editing and entry opening | app/Source/main.jsx |
| Home review queues | ReviewQueue.jsx, reviewQueue.js, PersonalReview.jsx in app/Source |
| Cross-year search | FindThings.jsx and findThings.js in app/Source |
| Yearbook | Rearview.jsx, rearview.js; app/rearview.py |
| Sidebar edition | app/Source/Edition.jsx |
| Tools organization | app/Source/ToolsNav.jsx |
| Appearance | app/web/style.css |
| HTTP routes and workbook operations | app/expense_book.py and other app/*.py modules |
| Builds, updates, packaging | tools/ |
| Synthetic regression checks | tests/ |

## Data boundary
Starter data may be in an external data folder selected through setup; app/data-location.json points to it. Use the app’s storage/backup controls to identify the actual folder. Do not assume all data is beside the executable.
The linked-workbooks.json configuration includes year links, reviews, editions and planning settings. rearview-YEAR.json stores yearbook notes/photos. Inspection history and loan trackers have their own files. Preserve all settings and linked workbooks, not merely the currently selected year. Inspect the app’s actual paths before recovery. Existing full-backup features should be used before installation.

Never test by copying an installed app whose links still point to real workbooks. Use tools/practice.py or a clean repository and synthetic files. Shared-folder safeguards reduce conflicting writes; avoid simultaneous editing by two users.

## Prepare development tools
Use Python 3.10 or newer (tested here with 3.12) and Node 24/npm. Open a terminal in this repository. On Windows, `py -3` may replace `python` below.

```text
npm ci
npm ci --prefix app/Source
node tools/build_frontend.mjs
python tools/verify.py
```

The committed lockfiles pin the tested dependencies. Do not run an automatic dependency upgrade as part of an unrelated small change. Verification stops on the first failure; preserve its error text for your helper. The frontend verification detects a stale bundle, rebuilds it, and asks you to review and rerun.

## Build an actual release
Make changes in a development copy, update docs/RELEASE-NOTES.md, then choose the next version in this product’s version family:

```text
python tools/set_version.py 3.32.53-alpha.3
python tools/refresh_sources.py
python tools/release.py
```

The example version is only for a future change. Do not change the baseline just to run tests. The release command builds, verifies, packages and checks the actual ZIPs. Outputs are in dist with SHA256SUMS.txt. Review tools/source-files.json after refreshing: it is an explicit source allowlist, not a request to include data. New runtime modules must also be added to RUNTIME_NAMES in tools/build_release.py.

If a future change requires a data migration, stop and design a reversible, separately tested migration. Do not silently expand updater scope to overwrite settings/workbooks. Keep LAST-VERIFIED.json as the previous baseline until the new release is verified and manually accepted; then record the new version and evidence.

## Pilot and install
1. Extract a fresh build into a separate test folder. Use synthetic data or copied workbooks whose links point only to the copies.
2. Start it with its Windows launcher. Check version, new behavior, search/open, editing, reviews and backup/restore. Confirm no unexpected console errors.
3. Back up the actual installation and every linked workbook. Close both users’ browser/app and command windows and linked Excel workbooks.
4. Extract the correct product’s Update ZIP and follow its APPLY-UPDATE instructions, targeting the existing app folder. Do not replace a data-bearing installation with a fresh starter folder.
5. Reopen; check version and a few known entries/settings. Keep the previous package and backups until accepted.

## Recover
If an update refuses to run, retain the error and stop; do not bypass version or running-app guards. If a change behaves badly, close the app and preserve the current data before experimenting. Restore a backup into an isolated folder first. App-Update-Backups contains program rollback material; restoring old code is different from restoring data. If records changed after the backup, do not overwrite them blindly. Ask the helper to compare and choose a consistent restore set including external linked workbooks. Never use the shareable starter as a live Expense Book recovery package.

## Keep versions understandable
Keep one working source repository per product. Commit source, lockfiles, tools, tests and notes; tag a release after its pilot, and record its exact ZIP hashes. Keep release ZIPs as downloads outside the source tree. Do not delete history to tidy the repository. The clean source package is prepared for public sharing. Data-bearing installations and the live Expense Book remain private.


## Reusable improvements through 3.32.36
Inspection contacts, destinations and visit-location reporting remain behind the
optional inspection/business modules. Inspection Brief is a read-only printable
view. Updated source: customerContacts.js, InspectionBrief.jsx, dealerVisits.js,
InspectionLocations.jsx, SidebarGroup.jsx and BusinessActivityNav.jsx.

Backup retention settings and cleanup history live in the configured DATA folder,
as do loan-tracker and inspection-history backups. Program-update recovery sets
remain under ROOT/App-Update-Backups. backup_retention.py handles both locations.
Only completed updater sets with PROGRAM-MANIFEST.json are eligible for cleanup;
older Starter update sets without that marker are deliberately left alone.
The retention switch begins Off, requires a folder review, and only cleans after
a verified full backup. Full recovery ZIPs are not automatically deleted.

## Quiet launcher and shutdown (3.32.53-alpha.1)

Start-App.bat delegates to quiet_start.py. Optional Install-Desktop-Shortcut.bat
creates a LOCALAPPDATA/CtrlUrFinances bootstrap and locally cached .ico, then a
Windows desktop shortcut. Its bootstrap loads current program files from the
installed Starter folder. Normal updates keep that shortcut working. Rerun the
installer after moving the installation, relocating Python, or changing its icon.
Start-App-Diagnostics.bat starts the same server with a visible console.

Exit Ctrl Ur Finances is available at the top right and in the sidebar. Save work
in all tabs first. The server refuses exit during backup or folder scans and
retains its shared-folder single-writer lock until shutdown. Running-session
metadata is excluded from backups/portable copies. The Starter's separate DATA
root, preferences and first-run behavior must remain intact when porting changes.
The icon's editable reference is app/web/shortcut-icon.svg; the packaged Windows
asset is app/Ctrl-Ur-Finances.ico. Source dependencies are for development only.


## GitHub upload labels

The version-setting command stamps a release comment at the top of .gitignore
and .gitattributes. Their actual rules are unchanged. Include these files with
the other top-level files during each repository upload; no manual comment edit
is needed. Use the same version commit message for each upload batch. GitHub may
still show older commit messages for other files whose contents did not change.
Its web upload limit still requires multiple batches for this repository.
