from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import uuid
from datetime import datetime
import json

from app.database import get_db
from app.models import (
    Email, EmailGenerateRequest, EmailRefineRequest, 
    EmailSendRequest, EmailResponse
)
from app.services import gemini, gmail

router = APIRouter()


@router.get("", response_model=List[Email])
async def list_emails():
    """List all emails (sent and drafts)."""
    with get_db() as conn:
        cursor = conn.execute("""
            SELECT e.*, c.email as contact_email, c.name as contact_name
            FROM emails e
            LEFT JOIN contacts c ON e.contact_id = c.id
            ORDER BY e.created_at DESC
        """)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]


@router.post("/generate", response_model=EmailResponse)
async def generate_email(request: EmailGenerateRequest):
    """Generate a personalized email using Gemini AI."""

    # Get contact details
    with get_db() as conn:
        cursor = conn.execute("SELECT * FROM contacts WHERE id = ?", (request.contact_id,))
        contact = cursor.fetchone()
        if not contact:
            raise HTTPException(status_code=404, detail="Contact not found")
        contact = dict(contact)

    # Parse company_context if available
    company_context = None
    if contact.get('company_context'):
        try:
            company_context = json.loads(contact['company_context'])
        except json.JSONDecodeError:
            pass  # Ignore malformed JSON

    try:
        result = gemini.generate_email(
            name=contact.get('name'),
            company=contact.get('company'),
            job_title=contact.get('job_title'),
            service=request.service,
            value_prop=request.value_prop,
            tone=request.tone,
            company_context=company_context
        )
        return EmailResponse(subject=result['subject'], body=result['body'])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")


@router.post("/refine", response_model=EmailResponse)
async def refine_email(request: EmailRefineRequest):
    """Refine an email based on feedback."""
    
    try:
        result = gemini.refine_email(
            subject=request.subject,
            body=request.body,
            feedback=request.feedback
        )
        return EmailResponse(subject=result['subject'], body=result['body'])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI refinement failed: {str(e)}")


@router.post("/send")
async def send_email(request: EmailSendRequest):
    """Send an email via Gmail."""
    
    # Get contact details
    with get_db() as conn:
        cursor = conn.execute("SELECT * FROM contacts WHERE id = ?", (request.contact_id,))
        contact = cursor.fetchone()
        if not contact:
            raise HTTPException(status_code=404, detail="Contact not found")
        contact = dict(contact)
    
    try:
        recipient_email = request.to_email or contact['email']
        recipient_name = request.to_name if request.to_name is not None else contact.get('name')

        # Send email
        result = gmail.send_email(
            to_email=recipient_email,
            subject=request.subject,
            body=request.body,
            to_name=recipient_name
        )
        
        if result['success']:
            # Save to database
            email_id = str(uuid.uuid4())
            with get_db() as conn:
                conn.execute(
                    """
                    INSERT INTO emails (id, contact_id, subject, body, context, status, sent_at)
                    VALUES (?, ?, ?, ?, ?, 'sent', ?)
                    """,
                    (email_id, request.contact_id, request.subject, request.body,
                     request.context, datetime.now().isoformat())
                )
            
            return {
                "success": True,
                "message": result['message'],
                "email_id": email_id
            }
        else:
            raise HTTPException(status_code=500, detail=result.get('message', 'Failed to send email'))
            
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")


class TestGmailRequest(BaseModel):
    gmail_email: str
    gmail_app_password: str


@router.post("/test-gmail")
async def test_gmail_connection(request: TestGmailRequest = None):
    """Test Gmail SMTP connection with provided or saved credentials."""
    try:
        if request and request.gmail_email and request.gmail_app_password:
            # Test with provided credentials
            result = gmail.test_connection_with_credentials(
                request.gmail_email, 
                request.gmail_app_password
            )
        else:
            # Test with saved credentials
            result = gmail.test_connection()
        return result
    except ValueError as e:
        return {"success": False, "message": str(e)}
    except Exception as e:
        return {"success": False, "message": f"Connection test failed: {str(e)}"}


@router.get("/{email_id}", response_model=Email)
async def get_email(email_id: str):
    """Get a specific email."""
    with get_db() as conn:
        cursor = conn.execute("SELECT * FROM emails WHERE id = ?", (email_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Email not found")
        return dict(row)
