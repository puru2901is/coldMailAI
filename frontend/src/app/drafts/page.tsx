"use client";

import { useEffect, useMemo, useState } from "react";
import { Email, getEmails, sendDraftEmail, updateDraftEmail } from "@/lib/api";

type DraftContext = {
  company_name?: string;
  website_url?: string;
  snapshot_link?: string;
  service?: string;
  source?: string;
};

function parseContext(context?: string): DraftContext {
  if (!context) return {};
  try {
    return JSON.parse(context);
  } catch {
    return {};
  }
}

export default function DraftsPage() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const drafts = useMemo(() => emails.filter((email) => email.status === "draft"), [emails]);
  const selectedDraft = drafts.find((email) => email.id === selectedId) || drafts[0] || null;
  const selectedContext = parseContext(selectedDraft?.context);

  useEffect(() => {
    async function loadEmails() {
      try {
        const data = await getEmails();
        setEmails(data);
        const firstDraft = data.find((email) => email.status === "draft");
        setSelectedId(firstDraft?.id || null);
      } catch (error) {
        showToast("Failed to load drafts", "error");
      } finally {
        setLoading(false);
      }
    }
    loadEmails();
  }, []);

  useEffect(() => {
    if (!selectedDraft) {
      setSubject("");
      setBody("");
      return;
    }
    setSubject(selectedDraft.subject);
    setBody(selectedDraft.body);
  }, [selectedDraft]);

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleSave() {
    if (!selectedDraft) return;
    setSaving(true);
    try {
      const updated = await updateDraftEmail(selectedDraft.id, { subject, body });
      setEmails((current) =>
        current.map((email) => (email.id === selectedDraft.id ? { ...email, ...updated } : email))
      );
      showToast("Draft saved", "success");
    } catch (error: any) {
      showToast(error.message || "Failed to save draft", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleSend() {
    if (!selectedDraft) return;
    setSending(true);
    try {
      await updateDraftEmail(selectedDraft.id, { subject, body });
      await sendDraftEmail(selectedDraft.id);
      setEmails((current) =>
        current.map((email) =>
          email.id === selectedDraft.id
            ? { ...email, subject, body, status: "sent", sent_at: new Date().toISOString() }
            : email
        )
      );
      showToast("Draft sent", "success");
      const nextDraft = drafts.find((email) => email.id !== selectedDraft.id);
      setSelectedId(nextDraft?.id || null);
    } catch (error: any) {
      showToast(error.message || "Failed to send draft", "error");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-dark-500">Loading drafts...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h1 className="text-3xl font-bold text-dark-900">Drafts</h1>
        <p className="text-dark-500 mt-1">Review generated emails before sending them manually.</p>
      </div>

      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg ${
            toast.type === "success" ? "bg-green-500 text-white" : "bg-red-500 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}

      {drafts.length === 0 ? (
        <div className="card p-12 text-center">
          <DraftEmptyIcon className="w-12 h-12 mx-auto mb-4 text-dark-300" />
          <p className="text-dark-700 font-medium">No drafts to review</p>
          <p className="text-sm text-dark-500 mt-1">
            Run the Peerpush draft wrapper to generate local app drafts.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-6">
          <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-dark-100">
              <h2 className="font-semibold text-dark-900">Pending Drafts ({drafts.length})</h2>
            </div>
            <div className="divide-y divide-dark-100 max-h-[720px] overflow-y-auto">
              {drafts.map((draft) => {
                const context = parseContext(draft.context);
                return (
                  <button
                    key={draft.id}
                    onClick={() => setSelectedId(draft.id)}
                    className={`w-full text-left px-6 py-4 hover:bg-dark-50 transition-colors ${
                      selectedDraft?.id === draft.id ? "bg-primary-50" : ""
                    }`}
                  >
                    <p className="font-medium text-dark-900 truncate">{draft.subject}</p>
                    <p className="text-sm text-dark-500 mt-1 truncate">
                      To: {draft.contact_name || draft.contact_email}
                    </p>
                    {context.company_name && (
                      <p className="text-xs text-dark-400 mt-1 truncate">{context.company_name}</p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {selectedDraft && (
            <div className="card">
              <div className="px-6 py-4 border-b border-dark-100 flex items-center justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-dark-900">Review Draft</h2>
                  <p className="text-sm text-dark-500 mt-1">
                    To: {selectedDraft.contact_name || selectedDraft.contact_email}
                  </p>
                </div>
                <span className="px-2.5 py-1 text-xs rounded-full bg-amber-100 text-amber-700">
                  Draft
                </span>
              </div>

              <div className="p-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InfoItem label="Company" value={selectedContext.company_name || "Unknown"} />
                  <InfoItem label="Source" value={selectedContext.source || "draft"} />
                  {selectedContext.website_url && (
                    <InfoLink label="Website" href={selectedContext.website_url} />
                  )}
                  {selectedContext.snapshot_link && (
                    <InfoLink label="Snapshot" href={selectedContext.snapshot_link} />
                  )}
                </div>

                <div>
                  <label className="text-xs font-medium text-dark-500 uppercase">Subject</label>
                  <input
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    className="input mt-2"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-dark-500 uppercase">Body</label>
                  <textarea
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    rows={16}
                    className="input mt-2 resize-y font-sans leading-6"
                  />
                </div>

                <div className="flex flex-wrap justify-end gap-3 pt-2">
                  <button
                    onClick={handleSave}
                    disabled={saving || sending}
                    className="btn btn-secondary"
                  >
                    {saving ? "Saving..." : "Save Draft"}
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={saving || sending}
                    className="btn btn-primary"
                  >
                    {sending ? "Sending..." : "Send Email"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-dark-100 p-3">
      <p className="text-xs font-medium text-dark-500 uppercase">{label}</p>
      <p className="text-sm text-dark-800 mt-1 truncate">{value}</p>
    </div>
  );
}

function InfoLink({ label, href }: { label: string; href: string }) {
  return (
    <div className="rounded-lg border border-dark-100 p-3">
      <p className="text-xs font-medium text-dark-500 uppercase">{label}</p>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="text-sm text-primary-600 hover:text-primary-700 mt-1 block truncate"
      >
        {href}
      </a>
    </div>
  );
}

function DraftEmptyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 6.75A2.25 2.25 0 016.75 4.5h10.5a2.25 2.25 0 012.25 2.25v10.5a2.25 2.25 0 01-2.25 2.25H6.75a2.25 2.25 0 01-2.25-2.25V6.75z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 8.25h7.5M8.25 12h7.5M8.25 15.75h4.5" />
    </svg>
  );
}
