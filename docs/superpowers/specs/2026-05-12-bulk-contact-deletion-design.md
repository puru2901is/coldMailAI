# Bulk Contact Deletion Design

## Goal

Allow users on the Contacts tab to select one or more contacts and delete the selected contacts in bulk. Selecting all contacts through the table header checkbox should make it possible to delete all currently visible contacts.

## User Experience

The contacts table gains a checkbox column. Each row checkbox toggles that contact's selected state. The header checkbox selects all currently visible filtered contacts when not all are selected, and clears those visible selections when all visible contacts are already selected.

When at least one contact is selected, a `Delete Selected (N)` action appears in the contacts header. Clicking it asks for confirmation with the exact number of selected contacts. If confirmed, the selected contact IDs are deleted, the table updates locally, selection is cleared, and a success toast is shown. If deletion fails, the current list and selection remain visible and an error toast is shown.

## Architecture

The backend exposes one bulk endpoint under the existing contacts router: `POST /api/contacts/bulk-delete`. The request body contains `contact_ids: string[]`. The response returns the number of deleted contacts so the UI can report accurate results.

The frontend adds a `deleteContacts(contactIds: string[])` helper in `frontend/src/lib/api.ts`. `frontend/src/app/contacts/page.tsx` owns selection state and calls the helper for bulk deletion. Existing single-contact delete behavior remains unchanged.

## Testing

Backend coverage verifies that posting contact IDs to the bulk-delete endpoint removes only those contacts and returns the deleted count. Frontend verification is via TypeScript build/lint because this project does not currently have a frontend test runner configured.
