"""
NX TERMINAL — Combined Runner
Starts both the simulation engine and blockchain listener.
Usage: python -m backend.engine.run_all
"""
import sys
import os
import threading
import time
from urllib.parse import urlparse
from contextlib import contextmanager

# Add engine directory to path
engine_dir = os.path.dirname(os.path.abspath(__file__))
if engine_dir not in sys.path:
    sys.path.insert(0, engine_dir)

# Parse DATABASE_URL
database_url = os.getenv("DATABASE_URL", "")
if database_url:
    parsed = urlparse(database_url)
    os.environ.setdefault("NX_DB_HOST", parsed.hostname or "localhost")
    os.environ.setdefault("NX_DB_PORT", str(parsed.port or 5432))
    os.environ.setdefault("NX_DB_NAME", parsed.path.lstrip("/"))
    os.environ.setdefault("NX_DB_USER", parsed.username or "postgres")
    os.environ.setdefault("NX_DB_PASS", parsed.password or "postgres")

import psycopg2
import psycopg2.extras
import engine
from config import DATABASE_URL as ENGINE_DB_URL, DB_SCHEMA
from listener import run_listener

# Detect SSL
db_host = os.getenv("NX_DB_HOST", "localhost")
sslmode = "require" if "render.com" in db_host else "prefer"

# Monkey-patch engine DB
@contextmanager
def get_db_with_ssl():
    conn = psycopg2.connect(
        ENGINE_DB_URL,
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

engine.get_db = get_db_with_ssl
print(f"Engine DB: {db_host} (ssl={sslmode})")


def start_listener():
    """Run listener in a separate thread."""
    print("[MAIN] Starting blockchain listener thread...")
    while True:
        try:
            run_listener()
        except Exception as e:
            print(f"[MAIN] Listener crashed: {e}. Restarting in 10s...")
            time.sleep(10)


def start_engine():
    """Run engine in the main thread."""
    print("[MAIN] Starting simulation engine...")
    while True:
        try:
            engine.run_engine()
        except Exception as e:
            print(f"[MAIN] Engine crashed: {e}. Restarting in 10s...")
            time.sleep(10)


if __name__ == "__main__":
    # Start listener in background thread
    listener_thread = threading.Thread(target=start_listener, daemon=True)
    listener_thread.start()

    # Give listener a moment to initialize
    time.sleep(2)

    # Run engine in main thread
    start_engine()
