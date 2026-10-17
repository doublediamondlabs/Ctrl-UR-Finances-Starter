# Publish the clean Starter preview

Keep the existing private repository and live Expense Book private. This package
has no .git directory and establishes nothing about the remote's previous commits.

1. Review LICENSE. This candidate uses MIT, matching RōM. Publish only if you intend
   to grant those permissions for the Starter as well.
2. Create a **new empty private repository**, for example `Ctrl-Ur-Finances-Starter`.
   Do not initialize another README or license. Clone it with GitHub Desktop.
3. Extract the Repository ZIP. Copy the contents inside `ctrl-ur-finances` into the
   new clone, preserving `.git`. Do not copy from your used installation.
4. Review Changes, commit `Public preview v3.32.53-alpha.2`, and push.
5. Pilot the fresh Starter on Windows using examples/TRY-IT.md: version, setup,
   save/reopen, spending comparisons, shortcut, Exit, and backup/restore.
6. Inspect the new files and initial history. Then change visibility to public.
   Enable private vulnerability reporting, dependency alerts, and CodeQL Default
   setup for Python and JavaScript/TypeScript. Check both jobs and scan findings
   before publishing the release.
7. Draft tag `v3.32.53-alpha.2` on the reviewed commit, paste RELEASE-NOTES.md, mark
   **pre-release**, and attach the fresh Starter ZIP and Starter Update ZIP.
   SHA256SUMS.txt is optional. The Repository ZIP is for source maintenance.

Suggested description: Offline household finances with visual spending comparisons,
reviews, backups and optional small-business tools. Built through an iterative,
AI-assisted development process and tested in our daily workflow.

Share the Releases link after publishing. RōM can link to the new repository and
explain that its Expense Book connection supports the Starter edition.
