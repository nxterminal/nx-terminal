"""
NX TERMINAL — Engine Runner for Render
Patches DB connection to support SSL, then runs the engine.
Usage: python -m backend.engine.run_engine
"""

import sys
import os
from urllib.parse import urlparse
from contextlib import contextmanager

# Add engine directory to path so engine.py's imports work
engine_dir = os.path.dirname(os.path.abspath(__file__))
if engine_dir not in sys.path:
    sys.path.insert(0, engine_dir)

# Parse DATABASE_URL if provided (Render sets this)
database_url = os.getenv("DATABASE_URL", "")
if database_url:
    parsed = urlparse(database_url)
    os.environ.setdefault("NX_DB_HOST", parsed.hostname or "localhost")
    os.environ.setdefault("NX_DB_PORT", str(parsed.port or 5432))
    os.environ.setdefault("NX_DB_NAME", parsed.path.lstrip("/"))
    os.environ.setdefault("NX_DB_USER", parsed.username or "postgres")
    os.environ.setdefault("NX_DB_PASS", parsed.password or "postgres")

# Now import engine (which imports config)
import psycopg2
import psycopg2.extras
import engine
from config import DATABASE_URL, DB_SCHEMA

# Detect SSL need
db_host = os.getenv("NX_DB_HOST", "localhost")
sslmode = "require" if "render.com" in db_host else "prefer"

# Monkey-patch get_db to add SSL support
@contextmanager
def get_db_with_ssl():
    conn = psycopg2.connect(
        DATABASE_URL,
        options=f"-c search_path={DB_SCHEMA}",
        sslmode=sslmode,
    )
    conn.autocommit = False
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

# Replace engine's get_db with SSL version
engine.get_db = get_db_with_ssl

print(f"Engine DB: {db_host} (ssl={sslmode})")

if __name__ == "__main__":
    engine.run_engine()
