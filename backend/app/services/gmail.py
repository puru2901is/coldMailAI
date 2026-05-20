import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional

from app.database import get_db


def clean_credential(value: str) -> str:
    """Clean credential string by removing non-ASCII chars and extra spaces."""
    if not value:
        return value
    # Replace non-breaking spaces and other whitespace, then strip
    return value.replace('\xa0', '').replace(' ', '').strip()


def get_gmail_credentials():
    """Get Gmail credentials from settings."""
    with get_db() as conn:
        cursor = conn.execute(
            "SELECT gmail_email, gmail_app_password, sender_name, signature FROM settings WHERE id = 1"
        )
        row = cursor.fetchone()
        if not row:
            raise ValueError("Settings not found")
        
        if not row['gmail_email'] or not row['gmail_app_password']:
            raise ValueError("Gmail credentials not configured. Please add them in Settings.")
        
        return {
            "email": clean_credential(row['gmail_email']),
            "password": clean_credential(row['gmail_app_password']),
            "sender_name": row['sender_name'] or row['gmail_email'],
            "signature": row['signature'] or ""
        }


def send_email(
    to_email: str,
    subject: str,
    body: str,
    to_name: Optional[str] = None
) -> dict:
    """Send an email via Gmail SMTP."""
    
    credentials = get_gmail_credentials()
    
    # Create message
    msg = MIMEMultipart('alternative')
    msg['Subject'] = subject
    msg['From'] = f"{credentials['sender_name']} <{credentials['email']}>"
    msg['To'] = f"{to_name} <{to_email}>" if to_name else to_email
    
    # Add signature if configured
    full_body = body
    if credentials['signature']:
        full_body += f"\n\n{credentials['signature']}"
    
    # Create plain text and HTML versions
    text_part = MIMEText(full_body, 'plain')
    
    # Simple HTML version
    html_body = full_body.replace('\n', '<br>')
    html_part = MIMEText(f"<html><body><p>{html_body}</p></body></html>", 'html')
    
    msg.attach(text_part)
    msg.attach(html_part)
    
    try:
        # Connect to Gmail SMTP
        with smtplib.SMTP('smtp.gmail.com', 587) as server:
            server.starttls()
            server.login(credentials['email'], credentials['password'])
            server.send_message(msg)
        
        return {
            "success": True,
            "message": f"Email sent successfully to {to_email}"
        }
    except smtplib.SMTPAuthenticationError:
        raise ValueError("Gmail authentication failed. Please check your email and app password.")
    except Exception as e:
        raise ValueError(f"Failed to send email: {str(e)}")


def test_connection() -> dict:
    """Test Gmail SMTP connection with saved credentials."""
    credentials = get_gmail_credentials()
    return test_connection_with_credentials(credentials['email'], credentials['password'])


def test_connection_with_credentials(email: str, password: str) -> dict:
    """Test Gmail SMTP connection with provided credentials."""
    # Clean up credentials - remove non-ASCII characters like non-breaking spaces
    email = clean_credential(email)
    password = clean_credential(password)
    
    try:
        with smtplib.SMTP('smtp.gmail.com', 587) as server:
            server.starttls()
            server.login(email, password)
        
        return {
            "success": True,
            "message": "Gmail connection successful!"
        }
    except smtplib.SMTPAuthenticationError:
        return {
            "success": False,
            "message": "Authentication failed. Please check your email and app password."
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Connection failed: {str(e)}"
        }
