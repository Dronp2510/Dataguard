from sqlalchemy import text

from .database import Base, engine


def ensure_sqlite_column(table: str, column: str, ddl_type: str) -> None:
    with engine.begin() as conn:
        columns = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
        names = {row[1] for row in columns}
        if column not in names:
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl_type}"))


def initialize_database() -> None:
    Base.metadata.create_all(bind=engine)
    ensure_sqlite_column("files", "is_compressed", "BOOLEAN DEFAULT 0")
    ensure_sqlite_column("files", "compression_algo", "VARCHAR")
    ensure_sqlite_column("files", "original_filename", "VARCHAR")
    ensure_sqlite_column("files", "original_size", "INTEGER")
    ensure_sqlite_column("files", "compressed_size", "INTEGER")
    ensure_sqlite_column("shares", "owner_id", "VARCHAR")
    ensure_sqlite_column("shares", "token", "VARCHAR")
    ensure_sqlite_column("shares", "key_iv", "VARCHAR")
    ensure_sqlite_column("shares", "key_salt", "VARCHAR")
    ensure_sqlite_column("shares", "max_views", "INTEGER")
    ensure_sqlite_column("shares", "views", "INTEGER DEFAULT 0")
    ensure_sqlite_column("shares", "is_active", "BOOLEAN DEFAULT 1")
    ensure_sqlite_column("share_access_logs", "action", "VARCHAR")
    ensure_sqlite_column("share_access_logs", "viewer_type", "VARCHAR")
    ensure_sqlite_column("share_access_logs", "viewer_label", "VARCHAR")
    ensure_sqlite_column("share_access_logs", "ip_address", "VARCHAR")
    ensure_sqlite_column("share_access_logs", "user_agent", "VARCHAR")
    ensure_sqlite_column("users", "notifications_seen_at", "DATETIME")
