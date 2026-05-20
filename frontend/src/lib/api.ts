const API_BASE = '/api';

export interface CompanyContext {
  description?: string;
  industry?: string;
  size?: string;
  products_services?: string;
  recent_news?: string;
  additional_notes?: string;
  source: 'auto_research' | 'manual' | 'hybrid';
  researched_at?: string;
  company_name?: string;
}

export interface CompanyResearchResponse {
  company_context: CompanyContext | null;
  success: boolean;
  message: string;
}

export interface Contact {
  id: string;
  email: string;
  name?: string;
  company?: string;
  job_title?: string;
  custom_data?: string;
  company_context?: string;  // JSON string
  created_at?: string;
}

export interface Email {
  id: string;
  contact_id: string;
  subject: string;
  body: string;
  context?: string;
  status: string;
  sent_at?: string;
  created_at?: string;
  contact_email?: string;
  contact_name?: string;
}

export interface Settings {
  id: number;
  gmail_email: string;
  gmail_app_password: string;
  gemini_api_key: string;
  sender_name: string;
  signature: string;
}

export interface EmailResponse {
  subject: string;
  body: string;
}

// Contacts API
export async function getContacts(): Promise<Contact[]> {
  const res = await fetch(`${API_BASE}/contacts`);
  if (!res.ok) throw new Error('Failed to fetch contacts');
  return res.json();
}

export async function createContact(contact: Omit<Contact, 'id' | 'created_at'>): Promise<Contact> {
  const res = await fetch(`${API_BASE}/contacts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(contact),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || 'Failed to create contact');
  }
  return res.json();
}

export async function deleteContact(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/contacts/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete contact');
}

export async function deleteContacts(contactIds: string[]): Promise<{ deleted: number }> {
  const res = await fetch(`${API_BASE}/contacts/bulk-delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contact_ids: contactIds }),
  });
  if (!res.ok) throw new Error('Failed to delete contacts');
  return res.json();
}

export async function uploadContacts(file: File): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/contacts/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error('Failed to upload contacts');
  return res.json();
}

// Emails API
export async function getEmails(): Promise<Email[]> {
  const res = await fetch(`${API_BASE}/emails`);
  if (!res.ok) throw new Error('Failed to fetch emails');
  return res.json();
}

export async function generateEmail(params: {
  contact_id: string;
  service: string;
  value_prop: string;
  tone: string;
}): Promise<EmailResponse> {
  const res = await fetch(`${API_BASE}/emails/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || 'Failed to generate email');
  }
  return res.json();
}

export async function refineEmail(params: {
  subject: string;
  body: string;
  feedback: string;
}): Promise<EmailResponse> {
  const res = await fetch(`${API_BASE}/emails/refine`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || 'Failed to refine email');
  }
  return res.json();
}

export async function sendEmail(params: {
  contact_id: string;
  subject: string;
  body: string;
  context?: string;
  to_email?: string;
  to_name?: string;
}): Promise<{ success: boolean; message: string; email_id: string }> {
  const res = await fetch(`${API_BASE}/emails/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || 'Failed to send email');
  }
  return res.json();
}

export async function updateDraftEmail(
  emailId: string,
  params: { subject: string; body: string }
): Promise<Email> {
  const res = await fetch(`${API_BASE}/emails/${emailId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || 'Failed to update draft');
  }
  return res.json();
}

export async function sendDraftEmail(emailId: string): Promise<{ success: boolean; message: string; email_id: string }> {
  const res = await fetch(`${API_BASE}/emails/${emailId}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || 'Failed to send draft');
  }
  return res.json();
}

export async function testGmailConnection(credentials?: { gmail_email: string; gmail_app_password: string }): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/emails/test-gmail`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: credentials ? JSON.stringify(credentials) : '{}',
  });
  return res.json();
}

// Settings API
export async function getSettings(): Promise<Settings> {
  const res = await fetch(`${API_BASE}/settings`);
  if (!res.ok) throw new Error('Failed to fetch settings');
  return res.json();
}

export async function updateSettings(settings: Partial<Settings>): Promise<Settings> {
  const res = await fetch(`${API_BASE}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error('Failed to update settings');
  return res.json();
}

// Contact Update API
export async function updateContact(
  id: string,
  updates: Partial<Omit<Contact, 'id' | 'created_at'>>
): Promise<Contact> {
  const res = await fetch(`${API_BASE}/contacts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || 'Failed to update contact');
  }
  return res.json();
}

// Company Research API
export async function researchCompany(contactId: string): Promise<CompanyResearchResponse> {
  const res = await fetch(`${API_BASE}/contacts/${contactId}/research`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || 'Failed to research company');
  }
  return res.json();
}
