"""
Database setup.

Security controls:
  - WAL mode: SQLite Write-Ahead Logging provides crash-consistent writes and
    allows the backup script to copy the DB while the app is running.
  - Integrity check on startup: detects silent corruption (bit rot, crashed writes).
  - check_same_thread=False: safe because FastAPI/SQLAlchemy manages its own
    connection pool with per-request sessions.
  - Data at rest: SQLite is stored in plaintext. The data volume (/app/data)
    MUST be on an encrypted Unraid share or host-level encrypted filesystem.
    See README → "Data security" for instructions.

References:
  WAL:            https://www.sqlite.org/wal.html
  Integrity check: https://www.sqlite.org/pragma.html#pragma_integrity_check
"""

import os
import logging
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from .config import settings

logger = logging.getLogger(__name__)

# Create data directory if it doesn't exist (container first-run)
_db_path = settings.database_url.replace("sqlite:////", "/").replace("sqlite:///", "")
if not _db_path.startswith(":memory:"):
    os.makedirs(os.path.dirname(_db_path) if os.path.dirname(_db_path) else ".", exist_ok=True)

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},
    # Pool settings — appropriate for SQLite single-writer model
    pool_pre_ping=True,     # detect stale connections
    pool_recycle=3600,      # recycle every hour
)


@event.listens_for(engine, "connect")
def _set_sqlite_pragmas(dbapi_conn, _connection_record):
    """
    Set SQLite pragmas on every new connection:
      - WAL mode:        durability without exclusive locks
      - foreign_keys ON: enforce referential integrity
      - journal_mode:    already WAL, but explicit for clarity
    """
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.execute("PRAGMA synchronous=NORMAL")   # safe with WAL; faster than FULL
    cursor.execute("PRAGMA temp_store=MEMORY")
    cursor.execute("PRAGMA cache_size=-64000")    # 64 MB page cache
    cursor.close()


def run_integrity_check() -> bool:
    """
    Run SQLite's built-in integrity check.
    Called once at startup. Logs a warning if any issues found.
    Returns True if DB is healthy.
    """
    try:
        with engine.connect() as conn:
            result = conn.execute(text("PRAGMA integrity_check")).fetchall()
            messages = [row[0] for row in result]
            if messages == ["ok"]:
                logger.info("SQLite integrity check: OK")
                return True
            else:
                logger.error("SQLite integrity check FAILED: %s", messages)
                return False
    except Exception as exc:
        logger.error("Could not run integrity check: %s", exc)
        return False


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
