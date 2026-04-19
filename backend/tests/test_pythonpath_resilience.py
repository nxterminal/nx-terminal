"""
Fix-D — PYTHONPATH resilience for the engine.

Reproduces the incident scenario where the engine was launched with
only `backend/engine` on sys.path (cd + PYTHONPATH=. on Render). Before
Fix-D this quietly set `ledger_insert = None` via the `except
ImportError` block in engine.py and disabled every shadow write.

These tests spawn isolated subprocess interpreters so the parent
process's sys.path / cached imports don't mask the failure mode we
care about.
"""

from __future__ import annotations

import os
import subprocess
import sys
import textwrap
from pathlib import Path


_PROJECT_ROOT = Path(__file__).resolve().parents[2]
_ENGINE_DIR = _PROJECT_ROOT / "backend" / "engine"


def _run_script(script: str, *, cwd: Path, env_pythonpath: str | None):
    """Execute a one-shot python script in a clean subprocess.

    Inherits the real environment (so site-packages resolve correctly),
    then overrides PYTHONPATH to the exact value under test. Pass
    ``env_pythonpath=None`` to unset PYTHONPATH entirely.
    """
    env = os.environ.copy()
    env.pop("PYTHONPATH", None)
    if env_pythonpath is not None:
        env["PYTHONPATH"] = env_pythonpath
    return subprocess.run(
        [sys.executable, "-c", textwrap.dedent(script)],
        cwd=str(cwd),
        env=env,
        capture_output=True,
        text=True,
        timeout=30,
    )


# ---------------------------------------------------------------------------
# PASO 5.1 — engine imports cleanly when invoked from project root with
# PYTHONPATH set to the project root (the happy path in render.yaml).
# ---------------------------------------------------------------------------


def test_engine_imports_cleanly_with_absolute_pythonpath():
    script = """
        import sys, os
        # Simulate `python backend/engine/run_all.py` from project root
        # with PYTHONPATH=/opt/render/project/src → maps to our cwd here.
        sys.path.insert(0, os.environ['PYTHONPATH'])
        # Engine module lives in a flat-import dir; `import engine` only
        # works once engine_dir is on path — run_all.py adds it, so
        # replicate that too.
        sys.path.insert(0, os.path.join(os.environ['PYTHONPATH'], 'backend/engine'))
        import importlib
        engine = importlib.import_module('engine')
        assert engine.ledger_insert is not None, 'shadow writes DISABLED'
        assert engine.admin_log_event is not None, 'admin_log_event missing'
        assert engine.is_shadow_write_enabled.__module__ != 'engine', (
            'is_shadow_write_enabled is the stub lambda, not the real function'
        )
        print('OK')
    """
    r = _run_script(script, cwd=_PROJECT_ROOT, env_pythonpath=str(_PROJECT_ROOT))
    assert r.returncode == 0, r.stderr
    assert "OK" in r.stdout
    # Under the clean path, the critical logger must NOT have fired.
    assert "CRITICAL: Failed to import" not in r.stderr
    assert "Shadow writes are DISABLED" not in r.stderr


# ---------------------------------------------------------------------------
# PASO 5.2 — the exact incident scenario: cd into backend/engine, set
# PYTHONPATH=., then import engine. The fallback in engine.py must
# recover by pushing project_root onto sys.path, so backend.services
# imports still succeed.
# ---------------------------------------------------------------------------


def test_engine_sys_path_fallback_recovers_from_broken_pythonpath():
    script = """
        import importlib, sys
        # Replicate the busted prod invocation: cwd=backend/engine,
        # PYTHONPATH=. — before Fix-D this broke shadow writes silently.
        import engine
        assert engine.ledger_insert is not None, (
            'ledger_insert is None — sys.path fallback did NOT recover'
        )
        assert engine.admin_log_event is not None, 'admin_log_event is None'
        # Project root must now be on sys.path thanks to the fallback.
        from pathlib import Path
        project_root = str(Path(engine.__file__).resolve().parent.parent.parent)
        assert project_root in sys.path, (
            'project root not injected into sys.path'
        )
        print('OK')
    """
    r = _run_script(script, cwd=_ENGINE_DIR, env_pythonpath=".")
    assert r.returncode == 0, r.stderr
    assert "OK" in r.stdout
    # And the critical import-failure logger must stay silent because
    # the fallback fixed sys.path before the guarded import fired.
    assert "CRITICAL: Failed to import" not in r.stderr


# ---------------------------------------------------------------------------
# PASO 5.3 — run_all.py also injects project root. Covers the codepath
# where the deployer runs `python run_all.py` directly (no -m) from
# inside backend/engine. Before Fix-D, threads in run_all.py that do
# `from backend.engine.sync_reconciler import ...` would log "import
# failed" and skip; now they start.
# ---------------------------------------------------------------------------


def test_run_all_injects_project_root_into_sys_path():
    script = """
        import sys, runpy
        # Simulate parsing run_all.py top-of-file imports only. We don't
        # run the main block because it would spawn threads. Instead,
        # read the top-of-file logic (sys.path injection) by exec'ing
        # the first ~30 lines in isolation.
        src = open('run_all.py').read()
        # Grab everything up to the `from config import` (which requires
        # backend/engine on path AND dependencies) so we test ONLY the
        # sys.path injection.
        stop = src.index('import psycopg2')
        exec(compile(src[:stop], 'run_all.py', 'exec'), {'__file__': 'run_all.py'})
        from pathlib import Path
        project_root = str(Path('run_all.py').resolve().parent.parent.parent)
        assert project_root in sys.path, (
            f'project root {project_root!r} not in sys.path after run_all init'
        )
        print('OK')
    """
    r = _run_script(script, cwd=_ENGINE_DIR, env_pythonpath=".")
    assert r.returncode == 0, r.stderr
    assert "OK" in r.stdout


# ---------------------------------------------------------------------------
# PASO 5.4 — verify the except branch is now LOUD if it ever fires.
# We can't easily force an ImportError for backend.services from inside
# a normal test, so we bypass the fallback by stubbing out the real
# modules with a sys.meta_path finder that rejects them, forcing the
# engine's try block to raise and the except to log.
# ---------------------------------------------------------------------------


def test_engine_import_failure_logs_critical_error():
    script = """
        import importlib, sys, logging, io

        # Block backend.services.* BEFORE engine.py's guarded try runs.
        class _Blocker:
            def find_module(self, name, path=None):
                if name.startswith('backend.services') or name == 'backend.services':
                    return self
                return None
            def find_spec(self, name, path=None, target=None):
                if name.startswith('backend.services'):
                    raise ImportError(f'blocked: {name}')
                return None
            def load_module(self, name):
                raise ImportError(f'blocked: {name}')
        sys.meta_path.insert(0, _Blocker())

        # Capture logs emitted to the critical logger.
        logger = logging.getLogger('nx_engine_import_failure')
        buf = io.StringIO()
        handler = logging.StreamHandler(buf)
        handler.setLevel(logging.ERROR)
        logger.addHandler(handler)
        logger.setLevel(logging.ERROR)

        # Now load engine.py — backend.services imports will fail, and
        # the except-branch must log a critical error.
        sys.path.insert(0, '.')
        sys.path.insert(0, 'backend/engine')
        import engine  # noqa: F401
        out = buf.getvalue()
        assert 'CRITICAL: Failed to import' in out, (
            f'expected critical log, got: {out!r}'
        )
        assert 'Shadow writes are DISABLED' in out
        # And the stubs must be in place so the module didn't crash.
        assert engine.ledger_insert is None
        assert engine.is_shadow_write_enabled() is False
        print('OK')
    """
    r = _run_script(script, cwd=_PROJECT_ROOT, env_pythonpath=str(_PROJECT_ROOT))
    assert r.returncode == 0, r.stderr
    assert "OK" in r.stdout
