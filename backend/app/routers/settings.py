from fastapi import APIRouter, HTTPException

from app.database import get_db
from app.models import Settings, SettingsUpdate

router = APIRouter()


@router.get("", response_model=Settings)
async def get_settings():
    """Get current settings."""
    with get_db() as conn:
        cursor = conn.execute("SELECT * FROM settings WHERE id = 1")
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Settings not found")
        
        # Mask sensitive data in response
        settings_dict = dict(row)
        if settings_dict.get('gmail_app_password'):
            settings_dict['gmail_app_password'] = '••••••••'
        if settings_dict.get('gemini_api_key'):
            settings_dict['gemini_api_key'] = '••••••••'
        
        return settings_dict


@router.put("", response_model=Settings)
async def update_settings(settings: SettingsUpdate):
    """Update settings."""
    with get_db() as conn:
        # Get current settings to preserve masked fields
        cursor = conn.execute("SELECT * FROM settings WHERE id = 1")
        current = dict(cursor.fetchone())
        
        # Only update non-masked values
        gmail_email = settings.gmail_email if settings.gmail_email else current['gmail_email']
        gmail_app_password = settings.gmail_app_password if settings.gmail_app_password and settings.gmail_app_password != '••••••••' else current['gmail_app_password']
        gemini_api_key = settings.gemini_api_key if settings.gemini_api_key and settings.gemini_api_key != '••••••••' else current['gemini_api_key']
        sender_name = settings.sender_name if settings.sender_name is not None else current['sender_name']
        signature = settings.signature if settings.signature is not None else current['signature']
        
        conn.execute(
            """
            UPDATE settings 
            SET gmail_email = ?, gmail_app_password = ?, gemini_api_key = ?, 
                sender_name = ?, signature = ?
            WHERE id = 1
            """,
            (gmail_email, gmail_app_password, gemini_api_key, sender_name, signature)
        )
        
        # Return masked response
        return {
            "id": 1,
            "gmail_email": gmail_email,
            "gmail_app_password": '••••••••' if gmail_app_password else '',
            "gemini_api_key": '••••••••' if gemini_api_key else '',
            "sender_name": sender_name,
            "signature": signature
        }


@router.get("/raw")
async def get_raw_settings():
    """Get raw settings (internal use for services)."""
    with get_db() as conn:
        cursor = conn.execute("SELECT * FROM settings WHERE id = 1")
        row = cursor.fetchone()
        if not row:
            return None
        return dict(row)
