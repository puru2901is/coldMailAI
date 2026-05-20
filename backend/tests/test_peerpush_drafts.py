import csv
import json
import sqlite3
from contextlib import contextmanager

from app.services import peerpush_drafts


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


def write_csv(path):
    rows = [
        {
            "name": "ReadyCo",
            "website_url": "https://ready.example",
            "twitter_username": "",
            "linkedin_url": "",
            "primary_email": "hello@ready.example",
            "snapshot_link": "https://runbyte.tech/share/ready",
            "snapshot_error": "",
        },
        {
            "name": "NoSnapshot",
            "website_url": "https://missing.example",
            "twitter_username": "",
            "linkedin_url": "",
            "primary_email": "hello@missing.example",
            "snapshot_link": "",
            "snapshot_error": "",
        },
        {
            "name": "ErroredSnapshot",
            "website_url": "https://errored.example",
            "twitter_username": "",
            "linkedin_url": "",
            "primary_email": "hello@errored.example",
            "snapshot_link": "https://runbyte.tech/share/errored",
            "snapshot_error": "Failed to upload",
        },
    ]
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)


def test_generates_draft_only_for_ready_snapshot_rows(tmp_path, monkeypatch):
    db_path = tmp_path / "app.db"
    csv_path = tmp_path / "peerpush.csv"
    initialize_schema(db_path)
    write_csv(csv_path)

    monkeypatch.setattr(peerpush_drafts, "get_db", lambda: temp_db(db_path))
    monkeypatch.setattr(
        peerpush_drafts.company_research,
        "research_company",
        lambda company_name, website_url=None: {
            "success": True,
            "company_context": {
                "description": f"{company_name} helps teams test software.",
                "industry": "Technology",
                "size": "1-10",
                "products_services": "Testing tools",
                "recent_news": "No recent news found",
                "source": "auto_research",
                "company_name": company_name,
            },
        },
    )
    monkeypatch.setattr(
        peerpush_drafts.gemini,
        "generate_email",
        lambda **kwargs: {
            "subject": "Reddit leads for ReadyCo",
            "body": "I found Reddit posts from people describing this problem.",
        },
    )

    result = peerpush_drafts.generate_peerpush_drafts(csv_path)

    assert result["created"] == 1
    assert result["skipped"] == 2
    assert result["errors"] == []

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    contacts = conn.execute("SELECT * FROM contacts").fetchall()
    emails = conn.execute("SELECT * FROM emails").fetchall()
    conn.close()

    assert len(contacts) == 1
    assert contacts[0]["email"] == "hello@ready.example"
    assert contacts[0]["company"] == "ReadyCo"
    assert len(emails) == 1
    assert emails[0]["status"] == "draft"
    assert emails[0]["sent_at"] is None
    assert "https://runbyte.tech/share/ready" in emails[0]["body"]
    context = json.loads(emails[0]["context"])
    assert context["snapshot_link"] == "https://runbyte.tech/share/ready"
    assert context["source"] == "peerpush_csv"


def test_skips_existing_draft_for_same_email_and_snapshot(tmp_path, monkeypatch):
    db_path = tmp_path / "app.db"
    csv_path = tmp_path / "peerpush.csv"
    initialize_schema(db_path)
    write_csv(csv_path)

    monkeypatch.setattr(peerpush_drafts, "get_db", lambda: temp_db(db_path))
    monkeypatch.setattr(
        peerpush_drafts.company_research,
        "research_company",
        lambda company_name, website_url=None: {"success": False, "company_context": None},
    )
    monkeypatch.setattr(
        peerpush_drafts.gemini,
        "generate_email",
        lambda **kwargs: {"subject": "Subject", "body": "Body"},
    )

    first = peerpush_drafts.generate_peerpush_drafts(csv_path)
    second = peerpush_drafts.generate_peerpush_drafts(csv_path)

    assert first["created"] == 1
    assert second["created"] == 0
    assert second["duplicates"] == 1

    conn = sqlite3.connect(db_path)
    email_count = conn.execute("SELECT COUNT(*) FROM emails").fetchone()[0]
    conn.close()
    assert email_count == 1
