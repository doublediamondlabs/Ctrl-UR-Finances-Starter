# Baseline preparation

Included: selected application source/runtime assets and dependency notices from
v3.6.0, with generic Family loan wording and removal of the personal one-time legacy
loan migration. Original author-name stripping was removed; existing note text is
preserved. The bank-specific CSV parser remains named for its supported format.

Excluded: all financial workbooks, CSV/PDF bank documents, runtime JSON, private
trial history import code/data, source snapshots containing private test fixtures,
old checkpoints, update backups and machine paths.

Validation: frontend bundles successfully and Python files compile. A source scan
checks known personal identifiers, old loan-specific migration constants and
machine paths. This establishes a clean development baseline, not a claim that the
household starter or production migration has passed acceptance testing.

Do not upload older source histories or checkpoints wholesale. Review new commits
for private data. Keep this repository private until sharing terms are settled.
