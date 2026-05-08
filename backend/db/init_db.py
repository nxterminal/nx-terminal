"""NX TERMINAL — Database init.

Run once after creating a fresh PostgreSQL instance to bring it up
to the current production schema:

    python -m backend.db.init_db

Phase 5.3.5: this file used to read `schema.sql` and execute it
directly. The single source of schema truth now lives in
`backend.db.migrate.run_auto_migrations`, which is the same function
the API calls on every startup. Re-running this script against an
already-initialized DB is a no-op (every CREATE/INSERT is idempotent).

Requires env vars: NX_DB_HOST, NX_DB_PORT, NX_DB_NAME, NX_DB_USER, NX_DB_PASS.
"""

import os

from backend.api.deps import init_db_pool, close_db_pool
from backend.db.migrate import run_auto_migrations


def init():
    db_user = os.getenv("NX_DB_USER", "postgres")
    db_host = os.getenv("NX_DB_HOST", "localhost")
    db_port = os.getenv("NX_DB_PORT", "5432")
    db_name = os.getenv("NX_DB_NAME", "nxterminal")
    print(f"Connecting to {db_user}@{db_host}:{db_port}/{db_name}...")
    init_db_pool(minconn=1, maxconn=2)
    print("Running migrate.run_auto_migrations()...")
    try:
        run_auto_migrations()
        print("✅ Schema initialized successfully")
    finally:
        close_db_pool()


if __name__ == "__main__":
    init()
