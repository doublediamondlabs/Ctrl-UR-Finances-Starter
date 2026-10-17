# Ctrl Ur Finances

**Offline household finances, with optional small-business tools.**

Public preview **v3.32.53-alpha.4** · Windows launchers · MIT license

Built through an iterative, AI-assisted development process and tested in our daily workflow.
This shareable Starter edition is derived from Expense Book. It begins with a
clean household setup. Automated checks use fictional records; this particular
preview still needs a Windows pilot before use with important data.

## What it does

- Track household purchases and income in local Excel-format workbooks.
- Compare months and years with Spending Mix doughnuts, horizontal charts, and selected categories.
- See review reminders and open the month that needs attention.
- Use **Find That Thing** to search expenses, inspections, dealers, and notes across linked years.
- Keep local backups, preview recovery, and optionally manage backup retention.
- Add photos and notes to **Year in the Rearview**.
- Enable business finance, inspections and mileage, loan tracking, family repayments,
  Move & Housing Planner, and RōM exchange only when useful.

No subscription, cloud account, bank login, telemetry, or hosted server is required.
This is a personal project, not a hosted accounting service.

## Download and start

Open this repository's **Releases** section and choose:

| Download | Use |
|---|---|
| `Ctrl-Ur-Finances-Starter-v3.32.53-alpha.4.zip` | Fresh installation |
| `Ctrl-Ur-Finances-Starter-Update-v3.32.53-alpha.4.zip` | Existing supported Starter installation |
| Repository ZIP / GitHub Source code | Development; runnable files are under `app/` |

1. Install **Python 3.10 or newer** on Windows. The launcher needs a working `py`
   or `python` command. No pip packages or Node.js are needed for normal use.
2. Extract the complete Starter ZIP into a permanent writable folder.
3. Run **Start-App.bat**. It opens a local browser page.
4. Enter a household name, starting year, and an empty data folder. Start in **Personal / Household**.
5. Optionally run **Install-Desktop-Shortcut.bat** from that installed folder.

Excel is not required to use the app. If you also edit a linked workbook in Excel,
save and close Excel before saving from the app. Start with a workbook created by
the Starter; this is not a universal importer for arbitrary spreadsheet layouts.
Try the fictional entries in [TRY-IT](examples/TRY-IT.md) in a disposable installation.

## Optional RōM connection

**Ctrl Ur Finances is the Starter edition of Expense Book.** It works independently
of [RōM](https://github.com/doublediamondlabs/RoM). RōM can receive a scheduled
inspection and return selected actual travel information through previewed JSON files.

RōM is not bundled or required. Business Finance, Inspections & Travel, and
**RōM Travel Exchange** must be enabled in **Modules & appearance** to use the connection.
They start off. Transfers are manual; there is no automatic synchronization.

## Your files and backups

Setup chooses the data folder. `data-location.json` points to it; linked workbooks
can also be elsewhere. Use the app's file-location and backup controls to review
actual paths and keep a separate verified backup.

A network folder can be used, but use one active app session at a time. This is
not a simultaneous multi-user database. Use **Exit Ctrl Ur Finances** before updates;
closing the browser tab alone does not stop the local application.

Share the clean downloaded ZIP, never your used application folder or a portable
copy containing your data. Keep workbooks, customer details, real-data screenshots,
and backup ZIPs out of public uploads.

## Updating

Back up first, exit on every computer, and close linked Excel workbooks. Extract
the separate **Starter Update** ZIP, run **Apply-Update.bat**, and choose your existing
Starter folder containing `Start-App.bat`. The updater verifies the version,
backs up recovery material, and replaces program files.

This is **not an update for the private live Double Diamond Expense Book**.
See [release notes](docs/RELEASE-NOTES.md) for supported Starter versions.

## Limitations

- Experimental preview; no warranty, support SLA, or guarantee of fitness for your records.
- Windows desktop is the supported launch workflow. Windows, shared-drive, shortcut,
  and printed-page behavior need user testing; automated checks here ran on Linux.
- Bank import handles the existing supported statement format. Generic bank PDFs,
  OCR, and live bank connections are not provided.
- Tax Preparation organizes records; it does not determine deductions, file taxes,
  or automatically track tax-law changes.
- Move Planner compares entered monthly cash assumptions; it does not calculate a purchase price.
- Data is stored as local files, not encrypted by the app. Computer/share permissions matter.
- A focused review and passing tests do not replace an independent security audit.

## Development and support

See [MAINTENANCE](docs/MAINTENANCE.md) for build commands and recovery,
[DEPENDENCIES](docs/DEPENDENCIES.md) for licenses, [SUPPORT](SUPPORT.md) for ordinary
issues, and [SECURITY](SECURITY.md) for private vulnerability reporting.
Maintenance is as time permits, with no promised response schedule.

MIT licensed; see [LICENSE](LICENSE). Bundled library notices are in
`app/THIRD-PARTY-NOTICES.txt` in source, or `THIRD-PARTY-NOTICES.txt` in the runnable ZIP.

**Developed by Double Diamond Labs — Adventure On!**

### Choosing files outside your data folder

Use the existing Browse/Choose button for a new external workbook, custom setup
folder or recovery ZIP. That selection grants access for the current app session.
Pasting an external path alone does not grant access. Existing linked workbooks
continue working after restart. Files within the data folder remain directly
accessible. Windows file selection supports local drives and network shares.
