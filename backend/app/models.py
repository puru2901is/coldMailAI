from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime


# Company Context Model
class CompanyContext(BaseModel):
    description: Optional[str] = None
    industry: Optional[str] = None
    size: Optional[str] = None
    products_services: Optional[str] = None
    recent_news: Optional[str] = None
    additional_notes: Optional[str] = None
    source: str = "manual"  # auto_research | manual | hybrid
    researched_at: Optional[datetime] = None
    company_name: Optional[str] = None


# Contact Models
class ContactBase(BaseModel):
    email: str
    name: Optional[str] = None
    company: Optional[str] = None
    job_title: Optional[str] = None
    custom_data: Optional[str] = None
    company_context: Optional[str] = None  # JSON string for company research data


class ContactCreate(ContactBase):
    pass


class Contact(ContactBase):
    id: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ContactBulkDeleteRequest(BaseModel):
    contact_ids: List[str]


class ContactBulkDeleteResponse(BaseModel):
    deleted: int


# Email Models
class EmailGenerateRequest(BaseModel):
    contact_id: str
    service: str
    value_prop: str
    tone: str = "professional"  # professional, friendly, casual


class EmailRefineRequest(BaseModel):
    subject: str
    body: str
    feedback: str


class EmailSendRequest(BaseModel):
    contact_id: str
    subject: str
    body: str
    context: Optional[str] = None
    to_email: Optional[EmailStr] = None
    to_name: Optional[str] = None


class EmailResponse(BaseModel):
    subject: str
    body: str


class Email(BaseModel):
    id: str
    contact_id: str
    subject: str
    body: str
    context: Optional[str] = None
    status: str = "draft"
    sent_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    contact_email: Optional[str] = None
    contact_name: Optional[str] = None

    class Config:
        from_attributes = True


# Settings Models
class SettingsBase(BaseModel):
    gmail_email: Optional[str] = ""
    gmail_app_password: Optional[str] = ""
    gemini_api_key: Optional[str] = ""
    sender_name: Optional[str] = ""
    signature: Optional[str] = ""


class SettingsUpdate(SettingsBase):
    pass


class Settings(SettingsBase):
    id: int = 1

    class Config:
        from_attributes = True


# Contact Update Model (for PATCH/PUT operations)
class ContactUpdate(BaseModel):
    name: Optional[str] = None
    company: Optional[str] = None
    job_title: Optional[str] = None
    custom_data: Optional[str] = None
    company_context: Optional[str] = None


# Company Research Response
class CompanyResearchResponse(BaseModel):
    company_context: Optional[CompanyContext] = None
    success: bool
    message: str
