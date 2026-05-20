import google.generativeai as genai
import json
import re
from typing import Optional
from datetime import datetime

from app.database import get_db


def get_gemini_client_with_search():
    """Get configured Gemini client with search grounding capability."""
    with get_db() as conn:
        cursor = conn.execute("SELECT gemini_api_key FROM settings WHERE id = 1")
        row = cursor.fetchone()
        if not row or not row['gemini_api_key']:
            raise ValueError("Gemini API key not configured. Please add it in Settings.")

        genai.configure(api_key=row['gemini_api_key'])
        return genai.GenerativeModel('gemini-3.1-flash-lite')


def research_company(company_name: str, website_url: Optional[str] = None) -> dict:
    """Research a company using Gemini with Google Search grounding."""

    model = get_gemini_client_with_search()

    prompt = f"""Research the company "{company_name}" and provide structured information about them.
{f'Their website might be: {website_url}' if website_url else ''}

Find and return the following information in valid JSON format:
{{
  "description": "2-3 sentence description of what the company does",
  "industry": "Primary industry (e.g., Technology, Healthcare, Finance, E-commerce, etc.)",
  "size": "Company size category (e.g., 1-10, 11-50, 51-200, 201-500, 501-1000, 1000+)",
  "products_services": "Main products or services they offer (1-2 sentences)",
  "recent_news": "Any recent notable news, funding, product launches, or updates (1 sentence, or 'No recent news found' if none)"
}}

Return ONLY valid JSON, no other text or explanation. If you cannot find information for a field, use null for that field.
"""

    try:
        # Enable Google Search grounding for better company research
        response = model.generate_content(
            prompt,
            tools='google_search_retrieval'
        )
        response_text = response.text.strip()

        # Extract JSON from response
        json_match = re.search(r'\{[^{}]*\}', response_text, re.DOTALL)
        if json_match:
            result = json.loads(json_match.group())
            return {
                "success": True,
                "company_context": {
                    "description": result.get("description"),
                    "industry": result.get("industry"),
                    "size": result.get("size"),
                    "products_services": result.get("products_services"),
                    "recent_news": result.get("recent_news"),
                    "additional_notes": None,
                    "source": "auto_research",
                    "researched_at": datetime.now().isoformat(),
                    "company_name": company_name
                },
                "message": "Company research completed successfully"
            }

        return {
            "success": False,
            "company_context": None,
            "message": "Could not parse research results from AI response"
        }

    except json.JSONDecodeError as e:
        return {
            "success": False,
            "company_context": None,
            "message": f"Failed to parse JSON response: {str(e)}"
        }
    except Exception as e:
        # Fallback: try without search grounding
        try:
            response = model.generate_content(prompt)
            response_text = response.text.strip()

            json_match = re.search(r'\{[^{}]*\}', response_text, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
                return {
                    "success": True,
                    "company_context": {
                        "description": result.get("description"),
                        "industry": result.get("industry"),
                        "size": result.get("size"),
                        "products_services": result.get("products_services"),
                        "recent_news": result.get("recent_news"),
                        "additional_notes": None,
                        "source": "auto_research",
                        "researched_at": datetime.now().isoformat(),
                        "company_name": company_name
                    },
                    "message": "Company research completed (without web search)"
                }
        except Exception as fallback_error:
            pass

        return {
            "success": False,
            "company_context": None,
            "message": f"Research failed: {str(e)}"
        }
