# A harmless practice change

This exercise changes only the sidebar label to “Find That Thing (Practice)”. It deliberately copies source files only, without settings, workbook links or data. The original source and installed application remain untouched.

From the provided source repository, choose a new sibling folder:

```text
python tools/practice.py ../expense-book-practice
cd ../expense-book-practice
npm ci
npm ci --prefix app/Source
node tools/build_frontend.mjs
python tools/verify.py
python tools/build_release.py
python tools/check_packages.py
```

Do not run these commands from your installed application folder. The helper refuses an existing destination. Inspect app/Source/main.jsx to see the changed text. Launch only the separate practice app (with synthetic setup/links) to see the label. Do not install practice ZIPs on your real app. Delete the practice folder when done; the baseline remains unchanged.

This is the full cycle: isolate → edit source → build the browser bundle → run checks → package → pilot. For an actual enhancement, a helper also updates the version/release notes and tests the relevant behavior. No knowledge of the whole application is required to repeat a small label exercise.
