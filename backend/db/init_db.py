"""
NX TERMINAL — Database Init
Run once after creating the Render PostgreSQL instance.

Usage:
  python -m backend.db.init_db

Requires env vars: NX_DB_HOST, NX_DB_PORT, NX_DB_NAME, NX_DB_USER, NX_DB_PASS
"""

import os
import sys
import psycopg2

DB_HOST = os.getenv("NX_DB_HOST", "localhost")
DB_PORT = int(os.getenv("NX_DB_PORT", "5432"))
DB_NAME = os.getenv("NX_DB_NAME", "nxterminal")
DB_USER = os.getenv("NX_DB_USER", "postgres")
DB_PASS = os.getenv("NX_DB_PASS", "postgres")

def init():
    print(f"Connecting to {DB_USER}@{DB_HOST}:{DB_PORT}/{DB_NAME}...")
    conn = psycopg2.connect(
        host=DB_HOST, port=DB_PORT, dbname=DB_NAME,
        user=DB_USER, password=DB_PASS
    )
    conn.autocommit = True

    schema_path = os.path.join(os.path.dirname(__file__), "schema.sql")
    with open(schema_path, "r") as f:
        sql = f.read()

    print("Running schema.sql...")
    with conn.cursor() as cur:
        cur.execute(sql)

    print("✅ Schema created successfully")
    conn.close()

if __name__ == "__main__":
    init()
