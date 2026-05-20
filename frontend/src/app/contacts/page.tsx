"use client";

import { useEffect, useState, useRef } from "react";
import {
  getContacts,
  createContact,
  deleteContact,
  deleteContacts,
  uploadContacts,
  Contact,
} from "@/lib/api";

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadContacts();
  }, []);

  async function loadContacts() {
    try {
      const data = await getContacts();
      setContacts(data);
    } catch (error) {
      showToast("Failed to load contacts", "error");
    } finally {
      setLoading(false);
    }
  }

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this contact?")) return;
    try {
      await deleteContact(id);
      setContacts(contacts.filter((c) => c.id !== id));
      setSelectedContactIds((current) => current.filter((contactId) => contactId !== id));
      showToast("Contact deleted", "success");
    } catch (error) {
      showToast("Failed to delete contact", "error");
    }
  }

  async function handleBulkDelete() {
    const count = selectedContactIds.length;
    if (count === 0) return;
    if (!confirm(`Are you sure you want to delete ${count} selected contact${count === 1 ? "" : "s"}?`)) return;

    try {
      const idsToDelete = new Set(selectedContactIds);
      const result = await deleteContacts(selectedContactIds);
      setContacts(contacts.filter((contact) => !idsToDelete.has(contact.id)));
      setSelectedContactIds([]);
      showToast(`Deleted ${result.deleted} contact${result.deleted === 1 ? "" : "s"}`, "success");
    } catch (error) {
      showToast("Failed to delete selected contacts", "error");
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await uploadContacts(file);
      showToast(`Imported ${result.imported} contacts (${result.skipped} skipped)`, "success");
      loadContacts();
    } catch (error) {
      showToast("Failed to upload CSV", "error");
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  const filteredContacts = contacts.filter(
    (c) =>
      c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.company?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const visibleContactIds = filteredContacts.map((contact) => contact.id);
  const selectedVisibleCount = visibleContactIds.filter((id) => selectedContactIds.includes(id)).length;
  const allVisibleSelected = visibleContactIds.length > 0 && selectedVisibleCount === visibleContactIds.length;

  function toggleContactSelection(contactId: string) {
    setSelectedContactIds((current) =>
      current.includes(contactId)
        ? current.filter((id) => id !== contactId)
        : [...current, contactId]
    );
  }

  function toggleVisibleContacts() {
    if (allVisibleSelected) {
      setSelectedContactIds((current) => current.filter((id) => !visibleContactIds.includes(id)));
      return;
    }

    setSelectedContactIds((current) => Array.from(new Set([...current, ...visibleContactIds])));
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-dark-900">Contacts</h1>
          <p className="text-dark-500 mt-1">Manage your email contacts</p>
        </div>
        <div className="flex flex-wrap justify-end gap-3">
          <input
            type="file"
            ref={fileInputRef}
            accept=".csv"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn btn-secondary"
          >
            <UploadIcon className="w-4 h-4 mr-2" />
            Upload CSV
          </button>
          {selectedContactIds.length > 0 && (
            <button onClick={handleBulkDelete} className="btn btn-danger">
              Delete Selected ({selectedContactIds.length})
            </button>
          )}
          <button onClick={() => setShowModal(true)} className="btn btn-primary">
            <PlusIcon className="w-4 h-4 mr-2" />
            Add Contact
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
        <input
          type="text"
          placeholder="Search contacts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input pl-12"
        />
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-dark-500 animate-pulse">Loading contacts...</div>
        ) : filteredContacts.length === 0 ? (
          <div className="p-12 text-center">
            <UsersIcon className="w-12 h-12 mx-auto mb-4 text-dark-300" />
            <p className="text-dark-500">
              {searchQuery ? "No contacts found" : "No contacts yet"}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setShowModal(true)}
                className="text-primary-600 hover:text-primary-700 mt-2"
              >
                Add your first contact
              </button>
            )}
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th className="w-12">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleVisibleContacts}
                    aria-label="Select all visible contacts"
                    className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                </th>
                <th>Email</th>
                <th>Name</th>
                <th>Company</th>
                <th>Job Title</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredContacts.map((contact) => (
                <tr key={contact.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedContactIds.includes(contact.id)}
                      onChange={() => toggleContactSelection(contact.id)}
                      aria-label={`Select ${contact.email}`}
                      className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    />
                  </td>
                  <td className="font-medium">{contact.email}</td>
                  <td>{contact.name || "—"}</td>
                  <td>{contact.company || "—"}</td>
                  <td>{contact.job_title || "—"}</td>
                  <td className="text-right">
                    <button
                      onClick={() => handleDelete(contact.id)}
                      className="text-red-600 hover:text-red-700 text-sm"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Contact Modal */}
      {showModal && (
        <AddContactModal
          onClose={() => setShowModal(false)}
          onAdd={async (contact) => {
            try {
              const newContact = await createContact(contact);
              setContacts([newContact, ...contacts]);
              setShowModal(false);
              showToast("Contact added successfully", "success");
            } catch (error: any) {
              showToast(error.message || "Failed to add contact", "error");
            }
          }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className={`toast ${toast.type === "success" ? "toast-success" : "toast-error"}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

function AddContactModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (contact: Omit<Contact, "id" | "created_at">) => void;
}) {
  const [form, setForm] = useState({
    email: "",
    name: "",
    company: "",
    job_title: "",
  });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email) return;
    setSubmitting(true);
    await onAdd(form);
    setSubmitting(false);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fadeIn">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-slideIn">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-dark-900">Add Contact</h2>
          <button onClick={onClose} className="text-dark-400 hover:text-dark-600">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Email *</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="input"
              placeholder="email@example.com"
            />
          </div>
          <div>
            <label className="label">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input"
              placeholder="John Doe"
            />
          </div>
          <div>
            <label className="label">Company</label>
            <input
              type="text"
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              className="input"
              placeholder="Acme Inc."
            />
          </div>
          <div>
            <label className="label">Job Title</label>
            <input
              type="text"
              value={form.job_title}
              onChange={(e) => setForm({ ...form, job_title: e.target.value })}
              className="input"
              placeholder="CEO"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn btn-primary flex-1">
              {submitting ? "Adding..." : "Add Contact"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Icons
function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
