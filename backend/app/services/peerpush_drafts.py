import csv
import json
import uuid
from pathlib import Path
from typing import Iterable, Optional

from app.database import get_db
from app.services import company_research, gemini


DEFAULT_CSV_PATH = Path("/Users/purushottambaghel/Downloads/peerpush_contacts_with_snapshots.csv")
SERVICE_NAME = "Runbyte.tech"
VALUE_PROP = (
    "Runbyte.tech helps companies get customers on Reddit by finding relevant posts "
    "where people describe the exact problems their products solve. Include the "
    "provided product snapshot link as concrete proof of relevant Reddit demand."
)


def ready_rows(csv_path: Path) -> Iterable[dict]:
    """Yield Peerpush rows that have an email and a successful snapshot."""
    with csv_path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            email = (row.get("primary_email") or "").strip()
            snapshot_link = (row.get("snapshot_link") or "").strip()
            snapshot_error = (row.get("snapshot_error") or "").strip()
            if email and snapshot_link and not snapshot_error:
                yield {key: (value or "").strip() for key, value in row.items()}


def _count_csv_rows(csv_path: Path) -> int:
    with csv_path.open(newline="", encoding="utf-8-sig") as f:
        return sum(1 for _ in csv.DictReader(f))


def _context_has_snapshot(context: Optional[str], snapshot_link: str) -> bool:
    if not context:
        return False
    try:
        data = json.loads(context)
    except json.JSONDecodeError:
        return snapshot_link in context
    return data.get("snapshot_link") == snapshot_link


def _draft_or_sent_exists(conn, email: str, snapshot_link: str) -> bool:
    cursor = conn.execute(
        """
        SELECT e.context
        FROM emails e
        JOIN contacts c ON c.id = e.contact_id
        WHERE lower(c.email) = lower(?)
          AND e.status IN ('draft', 'sent')
        """,
        (email,),
    )
    return any(_context_has_snapshot(row["context"], snapshot_link) for row in cursor.fetchall())


def _upsert_contact(conn, row: dict, company_context: Optional[dict]) -> str:
    email = row["primary_email"]
    company_name = row.get("name") or None
    custom_data = json.dumps(
        {
            "source": "peerpush_csv",
            "website_url": row.get("website_url"),
            "twitter_username": row.get("twitter_username"),
            "linkedin_url": row.get("linkedin_url"),
            "snapshot_link": row.get("snapshot_link"),
        }
    )
    company_context_json = json.dumps(company_context) if company_context else None

    cursor = conn.execute("SELECT id FROM contacts WHERE lower(email) = lower(?)", (email,))
    existing = cursor.fetchone()
    if existing:
        conn.execute(
            """
            UPDATE contacts
            SET company = ?, custom_data = ?, company_context = COALESCE(?, company_context)
            WHERE id = ?
            """,
            (company_name, custom_data, company_context_json, existing["id"]),
        )
        return existing["id"]

    contact_id = str(uuid.uuid4())
    conn.execute(
        """
        INSERT INTO contacts (id, email, name, company, job_title, custom_data, company_context)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (contact_id, email, None, company_name, None, custom_data, company_context_json),
    )
    return contact_id


def _snapshot_body(body: str, company_name: str, snapshot_link: str) -> str:
    if snapshot_link in body:
        return body
    return (
        f"{body.rstrip()}\n\n"
        f"I pulled together a snapshot of relevant Reddit conversations for "
        f"{company_name}: {snapshot_link}"
    )


def _draft_context(row: dict, company_context: Optional[dict]) -> str:
    return json.dumps(
        {
            "source": "peerpush_csv",
            "company_name": row.get("name"),
            "website_url": row.get("website_url"),
            "twitter_username": row.get("twitter_username"),
            "linkedin_url": row.get("linkedin_url"),
            "snapshot_link": row.get("snapshot_link"),
            "service": SERVICE_NAME,
            "value_prop": VALUE_PROP,
            "company_context": company_context,
        }
    )


def generate_peerpush_drafts(csv_path: Path = DEFAULT_CSV_PATH) -> dict:
    """Create local draft emails for Peerpush contacts with snapshots."""
    csv_path = Path(csv_path)
    result = {
        "total": _count_csv_rows(csv_path),
        "ready": 0,
        "created": 0,
        "skipped": 0,
        "duplicates": 0,
        "errors": [],
        "draft_ids": [],
    }

    for row in ready_rows(csv_path):
        result["ready"] += 1
        email = row["primary_email"]
        snapshot_link = row["snapshot_link"]
        company_name = row.get("name") or "your company"

        try:
            with get_db() as conn:
                if _draft_or_sent_exists(conn, email, snapshot_link):
                    result["duplicates"] += 1
                    result["skipped"] += 1
                    continue

            research = company_research.research_company(company_name, row.get("website_url"))
            company_context = research.get("company_context") if research.get("success") else None

            generated = gemini.generate_email(
                name=None,
                company=company_name,
                job_title=None,
                service=SERVICE_NAME,
                value_prop=VALUE_PROP,
                tone="professional",
                company_context=company_context,
            )
            subject = generated.get("subject") or f"Reddit leads for {company_name}"
            body = _snapshot_body(generated.get("body") or "", company_name, snapshot_link)

            with get_db() as conn:
                if _draft_or_sent_exists(conn, email, snapshot_link):
                    result["duplicates"] += 1
                    result["skipped"] += 1
                    continue

                contact_id = _upsert_contact(conn, row, company_context)
                draft_id = str(uuid.uuid4())
                conn.execute(
                    """
                    INSERT INTO emails (id, contact_id, subject, body, context, status, sent_at)
                    VALUES (?, ?, ?, ?, ?, 'draft', NULL)
                    """,
                    (draft_id, contact_id, subject, body, _draft_context(row, company_context)),
                )
                result["created"] += 1
                result["draft_ids"].append(draft_id)
        except Exception as exc:
            result["errors"].append(f"{email}: {exc}")
            result["skipped"] += 1

    missing_ready = result["total"] - result["ready"]
    result["skipped"] += missing_ready
    return result
