import sqlite3
from pathlib import Path
from contextlib import contextmanager

DATABASE_PATH = Path(__file__).parent.parent / "data" / "app.db"

def get_db_connection():
    """Get a database connection with row factory."""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

@contextmanager
def get_db():
    """Context manager for database connections."""
    conn = get_db_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def init_db():
    """Initialize database tables."""
    # Ensure data directory exists
    DATABASE_PATH.parent.mkdir(exist_ok=True)
    
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    # Create contacts table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS contacts (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            name TEXT,
            company TEXT,
            job_title TEXT,
            custom_data TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Create emails table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS emails (
            id TEXT PRIMARY KEY,
            contact_id TEXT REFERENCES contacts(id),
            subject TEXT NOT NULL,
            body TEXT NOT NULL,
            context TEXT,
            status TEXT DEFAULT 'draft',
            sent_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Create settings table (single row)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            gmail_email TEXT,
            gmail_app_password TEXT,
            gemini_api_key TEXT,
            sender_name TEXT,
            signature TEXT
        )
    """)
    
    # Insert default settings row if not exists
    cursor.execute("""
        INSERT OR IGNORE INTO settings (id, gmail_email, gmail_app_password, gemini_api_key, sender_name, signature)
        VALUES (1, '', '', '', '', '')
    """)

    # Migration: Add company_context column to contacts table if not exists
    try:
        cursor.execute("ALTER TABLE contacts ADD COLUMN company_context TEXT")
    except sqlite3.OperationalError:
        pass  # Column already exists

    conn.commit()
    conn.close()
    print("Database initialized successfully!")
