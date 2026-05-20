from fastapi import APIRouter, HTTPException, UploadFile, File
from typing import List
import uuid
import csv
import io
import json

from app.database import get_db
from app.models import (
    Contact,
    ContactBulkDeleteRequest,
    ContactBulkDeleteResponse,
    ContactCreate,
    ContactUpdate,
    CompanyResearchResponse,
)
from app.services import company_research

router = APIRouter()


@router.get("", response_model=List[Contact])
async def list_contacts():
    """List all contacts."""
    with get_db() as conn:
        cursor = conn.execute("SELECT * FROM contacts ORDER BY created_at DESC")
        rows = cursor.fetchall()
        return [dict(row) for row in rows]


@router.post("", response_model=Contact)
async def create_contact(contact: ContactCreate):
    """Create a new contact."""
    contact_id = str(uuid.uuid4())
    
    with get_db() as conn:
        try:
            conn.execute(
                """
                INSERT INTO contacts (id, email, name, company, job_title, custom_data)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (contact_id, contact.email, contact.name, contact.company, 
                 contact.job_title, contact.custom_data)
            )
        except Exception as e:
            if "UNIQUE constraint" in str(e):
                raise HTTPException(status_code=400, detail="Email already exists")
            raise HTTPException(status_code=500, detail=str(e))
        
        cursor = conn.execute("SELECT * FROM contacts WHERE id = ?", (contact_id,))
        row = cursor.fetchone()
        return dict(row)


@router.post("/bulk-delete", response_model=ContactBulkDeleteResponse)
async def bulk_delete_contacts(request: ContactBulkDeleteRequest):
    """Delete selected contacts."""
    if not request.contact_ids:
        return {"deleted": 0}

    placeholders = ", ".join("?" for _ in request.contact_ids)
    with get_db() as conn:
        cursor = conn.execute(
            f"DELETE FROM contacts WHERE id IN ({placeholders})",
            request.contact_ids,
        )
        return {"deleted": cursor.rowcount}


@router.get("/{contact_id}", response_model=Contact)
async def get_contact(contact_id: str):
    """Get a specific contact."""
    with get_db() as conn:
        cursor = conn.execute("SELECT * FROM contacts WHERE id = ?", (contact_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Contact not found")
        return dict(row)


@router.delete("/{contact_id}")
async def delete_contact(contact_id: str):
    """Delete a contact."""
    with get_db() as conn:
        cursor = conn.execute("DELETE FROM contacts WHERE id = ?", (contact_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Contact not found")
        return {"message": "Contact deleted successfully"}


@router.put("/{contact_id}", response_model=Contact)
async def update_contact(contact_id: str, contact_update: ContactUpdate):
    """Update a contact's information."""
    with get_db() as conn:
        # Check contact exists
        cursor = conn.execute("SELECT * FROM contacts WHERE id = ?", (contact_id,))
        existing = cursor.fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Contact not found")

        # Build update query dynamically for provided fields
        updates = []
        values = []
        update_data = contact_update.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            if value is not None:
                updates.append(f"{field} = ?")
                values.append(value)

        if updates:
            values.append(contact_id)
            conn.execute(
                f"UPDATE contacts SET {', '.join(updates)} WHERE id = ?",
                values
            )

        cursor = conn.execute("SELECT * FROM contacts WHERE id = ?", (contact_id,))
        return dict(cursor.fetchone())


@router.post("/{contact_id}/research", response_model=CompanyResearchResponse)
async def research_contact_company(contact_id: str):
    """Research company information for a contact using AI."""
    with get_db() as conn:
        cursor = conn.execute("SELECT * FROM contacts WHERE id = ?", (contact_id,))
        contact = cursor.fetchone()
        if not contact:
            raise HTTPException(status_code=404, detail="Contact not found")
        contact = dict(contact)

    company_name = contact.get('company')
    if not company_name:
        raise HTTPException(status_code=400, detail="Contact has no company name to research")

    try:
        result = company_research.research_company(company_name)

        # Auto-save if successful
        if result['success'] and result['company_context']:
            with get_db() as conn:
                conn.execute(
                    "UPDATE contacts SET company_context = ? WHERE id = ?",
                    (json.dumps(result['company_context']), contact_id)
                )

        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Research failed: {str(e)}")


@router.post("/upload")
async def upload_contacts(file: UploadFile = File(...)):
    """Upload contacts from CSV file."""
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be a CSV")
    
    content = await file.read()
    decoded = content.decode('utf-8')
    
    # Parse CSV
    reader = csv.DictReader(io.StringIO(decoded))
    
    # Map common column names
    column_mapping = {
        'email': ['email', 'e-mail', 'email_address', 'emailaddress'],
        'name': ['name', 'full_name', 'fullname', 'contact_name'],
        'company': ['company', 'company_name', 'organization', 'org'],
        'job_title': ['job_title', 'jobtitle', 'title', 'position', 'role']
    }
    
    imported = 0
    skipped = 0
    errors = []
    
    with get_db() as conn:
        for row in reader:
            # Normalize column names to lowercase
            row_lower = {k.lower().strip(): v for k, v in row.items()}
            
            # Extract fields with mapping
            email = None
            name = None
            company = None
            job_title = None
            
            for field, aliases in column_mapping.items():
                for alias in aliases:
                    if alias in row_lower and row_lower[alias]:
                        if field == 'email':
                            email = row_lower[alias].strip()
                        elif field == 'name':
                            name = row_lower[alias].strip()
                        elif field == 'company':
                            company = row_lower[alias].strip()
                        elif field == 'job_title':
                            job_title = row_lower[alias].strip()
                        break
            
            if not email:
                skipped += 1
                continue
            
            contact_id = str(uuid.uuid4())
            try:
                conn.execute(
                    """
                    INSERT INTO contacts (id, email, name, company, job_title)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (contact_id, email, name, company, job_title)
                )
                imported += 1
            except Exception as e:
                if "UNIQUE constraint" in str(e):
                    skipped += 1
                else:
                    errors.append(f"Error importing {email}: {str(e)}")
    
    return {
        "message": f"Import complete",
        "imported": imported,
        "skipped": skipped,
        "errors": errors
    }
