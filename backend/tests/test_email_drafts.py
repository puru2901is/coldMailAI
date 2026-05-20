import sqlite3
from contextlib import contextmanager

from fastapi.testclient import TestClient

from app.main import app
from app.routers import emails


def initialize_schema(db_path):
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
    conn.execute(
        """
        CREATE TABLE emails (
            id TEXT PRIMARY KEY,
            contact_id TEXT REFERENCES contacts(id),
            subject TEXT NOT NULL,
            body TEXT NOT NULL,
            context TEXT,
            status TEXT DEFAULT 'draft',
            sent_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    conn.execute(
        "INSERT INTO contacts (id, email, name) VALUES ('contact-1', 'to@example.com', 'Taylor')"
    )
    conn.execute(
        """
        INSERT INTO emails (id, contact_id, subject, body, context, status, sent_at)
        VALUES ('email-1', 'contact-1', 'Old subject', 'Old body', '{}', 'draft', NULL)
        """
    )
    conn.commit()
    conn.close()


@contextmanager
def temp_db(db_path):
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


def test_update_draft_edits_subject_and_body(tmp_path, monkeypatch):
    db_path = tmp_path / "app.db"
    initialize_schema(db_path)
    monkeypatch.setattr(emails, "get_db", lambda: temp_db(db_path))

    client = TestClient(app)
    response = client.put(
        "/api/emails/email-1",
        json={"subject": "New subject", "body": "New body"},
    )

    assert response.status_code == 200
    assert response.json()["subject"] == "New subject"
    assert response.json()["body"] == "New body"

    conn = sqlite3.connect(db_path)
    row = conn.execute("SELECT subject, body FROM emails WHERE id = 'email-1'").fetchone()
    conn.close()
    assert row == ("New subject", "New body")


def test_send_draft_uses_existing_row_and_marks_sent(tmp_path, monkeypatch):
    db_path = tmp_path / "app.db"
    initialize_schema(db_path)
    monkeypatch.setattr(emails, "get_db", lambda: temp_db(db_path))

    sent = {}

    def fake_send_email(to_email, subject, body, to_name=None):
        sent.update(
            {
                "to_email": to_email,
                "subject": subject,
                "body": body,
                "to_name": to_name,
            }
        )
        return {"success": True, "message": "sent"}

    monkeypatch.setattr(emails.gmail, "send_email", fake_send_email)

    client = TestClient(app)
    response = client.post("/api/emails/email-1/send")

    assert response.status_code == 200
    assert response.json()["email_id"] == "email-1"
    assert sent == {
        "to_email": "to@example.com",
        "subject": "Old subject",
        "body": "Old body",
        "to_name": "Taylor",
    }

    conn = sqlite3.connect(db_path)
    rows = conn.execute("SELECT id, status, sent_at FROM emails").fetchall()
    conn.close()
    assert len(rows) == 1
    assert rows[0][0] == "email-1"
    assert rows[0][1] == "sent"
    assert rows[0][2] is not None
