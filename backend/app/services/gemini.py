import google.generativeai as genai
import json
import re
from typing import Optional

from app.database import get_db


def get_gemini_client():
    """Get configured Gemini client."""
    with get_db() as conn:
        cursor = conn.execute("SELECT gemini_api_key FROM settings WHERE id = 1")
        row = cursor.fetchone()
        if not row or not row['gemini_api_key']:
            raise ValueError("Gemini API key not configured. Please add it in Settings.")
        
        genai.configure(api_key=row['gemini_api_key'])
        return genai.GenerativeModel('gemini-2.5-flash-lite')


def generate_email(
    name: Optional[str],
    company: Optional[str],
    job_title: Optional[str],
    service: str,
    value_prop: str,
    tone: str = "professional",
    company_context: Optional[dict] = None
) -> dict:
    """Generate a personalized cold email using Gemini."""

    model = get_gemini_client()

    # Build enriched company info section
    company_info = f"Company: {company or 'their company'}"
    if company_context:
        if company_context.get('description'):
            company_info += f"\n  - About: {company_context['description']}"
        if company_context.get('industry'):
            company_info += f"\n  - Industry: {company_context['industry']}"
        if company_context.get('size'):
            company_info += f"\n  - Company Size: {company_context['size']}"
        if company_context.get('products_services'):
            company_info += f"\n  - Products/Services: {company_context['products_services']}"
        if company_context.get('recent_news'):
            company_info += f"\n  - Recent News: {company_context['recent_news']}"
        if company_context.get('additional_notes'):
            company_info += f"\n  - Additional Notes: {company_context['additional_notes']}"

    prompt = f"""You are a professional cold email writer. Write a personalized cold email.

Recipient:
- Name: {name or 'there'}
- Job Title: {job_title or 'Professional'}
- {company_info}

Context:
- Service/Product: {service}
- Value Proposition: {value_prop}
- Tone: {tone}

Write a concise, engaging cold email that:
1. Has a compelling subject line (keep it short, under 50 characters)
2. Opens with personalization (reference their company, industry, or recent news if available)
3. Clearly states the value proposition in 2-3 sentences
4. Connects your offering to their specific business context when possible
5. Ends with a clear, low-pressure call to action
6. Keep the entire email under 150 words

Return ONLY valid JSON in this exact format, no other text:
{{"subject": "Your subject line here", "body": "Your email body here"}}
"""

    try:
        response = model.generate_content(prompt)
        response_text = response.text.strip()
        
        # Try to extract JSON from response
        json_match = re.search(r'\{[^{}]*\}', response_text, re.DOTALL)
        if json_match:
            result = json.loads(json_match.group())
            return {
                "subject": result.get("subject", "Quick Question"),
                "body": result.get("body", response_text)
            }
        
        # Fallback: return as-is
        return {
            "subject": "Quick Question",
            "body": response_text
        }
    except json.JSONDecodeError:
        # If JSON parsing fails, return the raw response
        return {
            "subject": "Quick Question",
            "body": response.text.strip()
        }


def refine_email(subject: str, body: str, feedback: str) -> dict:
    """Refine an existing email based on feedback."""
    
    model = get_gemini_client()
    
    prompt = f"""Refine this cold email based on the feedback provided.

Current Email:
Subject: {subject}
Body: {body}

Feedback: {feedback}

Apply the feedback to improve the email. Keep it concise and professional.

Return ONLY valid JSON in this exact format, no other text:
{{"subject": "Your improved subject line here", "body": "Your improved email body here"}}
"""

    try:
        response = model.generate_content(prompt)
        response_text = response.text.strip()
        
        # Try to extract JSON from response
        json_match = re.search(r'\{[^{}]*\}', response_text, re.DOTALL)
        if json_match:
            result = json.loads(json_match.group())
            return {
                "subject": result.get("subject", subject),
                "body": result.get("body", response_text)
            }
        
        return {
            "subject": subject,
            "body": response_text
        }
    except json.JSONDecodeError:
        return {
            "subject": subject,
            "body": response.text.strip()
        }
