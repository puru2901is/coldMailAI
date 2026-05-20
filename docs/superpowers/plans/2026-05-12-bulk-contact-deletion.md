# Bulk Contact Deletion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add checkbox selection and selected-contact bulk deletion to the Contacts tab.

**Architecture:** The backend provides a bulk-delete endpoint that deletes contacts by explicit IDs. The frontend keeps selected IDs in ContactsPage state, lets users select rows or all visible filtered rows, and calls the endpoint once for selected deletion.

**Tech Stack:** FastAPI, SQLite, Pydantic, Next.js, React, TypeScript, Tailwind CSS.

---

### Task 1: Backend Bulk Delete API

**Files:**
- Modify: `backend/app/models.py`
- Modify: `backend/app/routers/contacts.py`
- Create: `backend/tests/test_contacts_bulk_delete.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_contacts_bulk_delete.py` with a FastAPI `TestClient`, a temporary SQLite database, and a test that inserts three contacts, posts two IDs to `/api/contacts/bulk-delete`, and asserts only one contact remains.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_contacts_bulk_delete.py -v`
Expected: FAIL because `/api/contacts/bulk-delete` is not implemented.

- [ ] **Step 3: Write minimal implementation**

Add `ContactBulkDeleteRequest` and `ContactBulkDeleteResponse` Pydantic models. Add `@router.post("/bulk-delete")` before `@router.get("/{contact_id}")` so the static route is not captured as a contact ID. Delete only IDs supplied in the request and return `{"deleted": cursor.rowcount}`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_contacts_bulk_delete.py -v`
Expected: PASS.

### Task 2: Frontend Selection and Bulk Action

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/app/contacts/page.tsx`

- [ ] **Step 1: Add API helper**

Add `deleteContacts(contactIds: string[]): Promise<{ deleted: number }>` that posts `{ contact_ids: contactIds }` to `/api/contacts/bulk-delete`.

- [ ] **Step 2: Add selection state**

In `ContactsPage`, track `selectedContactIds`, derive visible selected state from `filteredContacts`, and clear stale selections when contacts are deleted.

- [ ] **Step 3: Add UI controls**

Add a checkbox column, row checkboxes, a header checkbox for visible rows, and a `Delete Selected (N)` button shown when at least one contact is selected.

- [ ] **Step 4: Add bulk deletion handler**

Confirm deletion count, call `deleteContacts`, remove deleted IDs from `contacts`, clear selection, and show success or error toast.

### Task 3: Verification

**Files:**
- Verify: `backend/tests/test_contacts_bulk_delete.py`
- Verify: `frontend/src/lib/api.ts`
- Verify: `frontend/src/app/contacts/page.tsx`

- [ ] **Step 1: Backend test**

Run: `cd backend && python -m pytest tests/test_contacts_bulk_delete.py -v`
Expected: PASS.

- [ ] **Step 2: Frontend checks**

Run: `cd frontend && npm run lint`
Expected: PASS, or report the exact blocking issue if the project lint command is not configured for this environment.

- [ ] **Step 3: Build check**

Run: `cd frontend && npm run build`
Expected: PASS.
