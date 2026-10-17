"""File access granted by configured roots or a native chooser, never by HTTP alone.

Chooser grants last for this process only and are scoped to one purpose. Keep
remember() calls at native chooser/generated-file sites, not request handlers
that merely receive a user-supplied path.
"""
import os
from pathlib import Path

_GRANTS = {}

def remember(purpose, selected):
    if selected:
        path = Path(selected).expanduser().resolve()
        _GRANTS.setdefault(purpose, set()).add(path)
    return selected

def request_path(value, purpose, root, known=(), descendants=True):
    if not isinstance(value, str) or not value.strip() or any(ord(c) < 32 for c in value):
        raise ValueError('Choose a valid file or folder using Browse.')
    value = value.strip().strip('"')
    # Normalize before the boundary check, including symlinks and junctions.
    candidate = os.path.realpath(os.path.expanduser(value))
    base = os.path.realpath(str(root))
    folded = os.path.normcase(candidate)
    base_folded = os.path.normcase(base)
    if folded == base_folded or (descendants and folded.startswith(base_folded.rstrip(os.sep) + os.sep)):
        return Path(candidate)
    # Return the trusted stored object, not a path reconstructed from the request.
    for approved in (*known, *_GRANTS.get(purpose, ())):
        trusted = Path(approved).resolve()
        if folded == os.path.normcase(str(trusted)):
            return trusted
    raise ValueError('This location is outside the data folder. Use the file or folder chooser to select it for this session, then try again.')

def workbook(app, value):
    config = app.load_config()
    items = list(config.get('years', {}).values())
    if config.get('loan'):
        items.append(config['loan'])
    known = [app.resolve_path(item['path']) for item in items]
    try:
        return request_path(value, 'workbook', app.DATA, known)
    except ValueError as exc:
        raise app.UserError(str(exc)) from exc

def matches(value, expected, root):
    """Compare optimistic-lock path labels without accessing request-supplied paths."""
    if not isinstance(value, str):
        return False
    aliases = [str(expected.resolve())]
    try:
        aliases.append(expected.resolve().relative_to(root.resolve()).as_posix())
    except ValueError:
        pass
    return os.path.normcase(os.path.normpath(value)) in {
        os.path.normcase(os.path.normpath(alias)) for alias in aliases
    }

def archive_member(stage, name):
    base = os.path.realpath(str(stage))
    candidate = os.path.realpath(os.path.join(base, name))
    if not candidate.startswith(base.rstrip(os.sep) + os.sep):
        raise ValueError('Backup member escapes the restore review folder.')
    return Path(candidate)
