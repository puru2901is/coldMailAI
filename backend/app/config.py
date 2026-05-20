from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    app_name: str = "Cold Email AI"
    database_url: str = "sqlite+aiosqlite:///./data/app.db"
    
    # These will be stored in DB and loaded at runtime
    gemini_api_key: str = ""
    gmail_email: str = ""
    gmail_app_password: str = ""
    
    class Config:
        env_file = ".env"


settings = Settings()

# Ensure data directory exists
DATA_DIR = Path(__file__).parent.parent / "data"
DATA_DIR.mkdir(exist_ok=True)
