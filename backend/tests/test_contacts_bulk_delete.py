import sqlite3
from contextlib import contextmanager

from fastapi.testclient import TestClient

from app.main import app
from app.routers import contacts


def initialize_contacts_schema(db_path):
    conn = sqlite3.connect(db_path)
    conn.execute(
        """
        CREATE TABLE contacts (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            name TEXT,
            company TEXT,
            job_title TEXT,
            custom_data TEXT,
            company_context TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    conn.commit()
    conn.close()


def insert_contact(db_path, contact_id, email):
    conn = sqlite3.connect(db_path)
    conn.execute(
        "INSERT INTO contacts (id, email) VALUES (?, ?)",
        (contact_id, email),
    )
    conn.commit()
    conn.close()


def fetch_contact_ids(db_path):
    conn = sqlite3.connect(db_path)
    rows = conn.execute("SELECT id FROM contacts ORDER BY id").fetchall()
    conn.close()
    return [row[0] for row in rows]


def test_bulk_delete_removes_only_selected_contacts(tmp_path, monkeypatch):
    db_path = tmp_path / "app.db"
    initialize_contacts_schema(db_path)
    insert_contact(db_path, "contact-1", "one@example.com")
    insert_contact(db_path, "contact-2", "two@example.com")
    insert_contact(db_path, "contact-3", "three@example.com")

    @contextmanager
    def temp_db():
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    monkeypatch.setattr(contacts, "get_db", temp_db)

    client = TestClient(app)
    response = client.post(
        "/api/contacts/bulk-delete",
        json={"contact_ids": ["contact-1", "contact-3"]},
    )

    assert response.status_code == 200
    assert response.json() == {"deleted": 2}
    assert fetch_contact_ids(db_path) == ["contact-2"]
