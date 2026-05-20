"use client";

import { useEffect, useState } from "react";
import { getEmails, Email } from "@/lib/api";

export default function HistoryPage() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);

  useEffect(() => {
    async function loadEmails() {
      try {
        const data = await getEmails();
        setEmails(data);
      } catch (error) {
        console.error("Failed to load emails:", error);
      } finally {
        setLoading(false);
      }
    }
    loadEmails();
  }, []);

  const sentEmails = emails.filter((e) => e.status === "sent");

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-dark-900">Email History</h1>
        <p className="text-dark-500 mt-1">View all your sent emails</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Email List */}
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-dark-100">
            <h2 className="font-semibold text-dark-900">
              Sent Emails ({sentEmails.length})
            </h2>
          </div>
          
          {loading ? (
            <div className="p-12 text-center text-dark-500 animate-pulse">
              Loading emails...
            </div>
          ) : sentEmails.length === 0 ? (
            <div className="p-12 text-center">
              <MailIcon className="w-12 h-12 mx-auto mb-4 text-dark-300" />
              <p className="text-dark-500">No emails sent yet</p>
              <a
                href="/compose"
                className="text-primary-600 hover:text-primary-700 mt-2 inline-block"
              >
                Compose your first email
              </a>
            </div>
          ) : (
            <div className="divide-y divide-dark-100 max-h-[600px] overflow-y-auto">
              {sentEmails.map((email) => (
                <button
                  key={email.id}
                  onClick={() => setSelectedEmail(email)}
                  className={`w-full text-left px-6 py-4 hover:bg-dark-50 transition-colors ${
                    selectedEmail?.id === email.id ? "bg-primary-50" : ""
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-dark-900 truncate">
                        {email.subject}
                      </p>
                      <p className="text-sm text-dark-500 mt-1">
                        To: {email.contact_name || email.contact_email}
                      </p>
                    </div>
                    <div className="ml-4 flex flex-col items-end">
                      <span className="text-xs text-dark-400">
                        {email.sent_at
                          ? new Date(email.sent_at).toLocaleDateString()
                          : ""}
                      </span>
                      <span className="mt-1 px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">
                        Sent
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Email Detail */}
        <div className="card">
          {selectedEmail ? (
            <div>
              <div className="px-6 py-4 border-b border-dark-100">
                <h2 className="font-semibold text-dark-900">Email Details</h2>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-xs font-medium text-dark-500 uppercase">
                    To
                  </label>
                  <p className="text-dark-900 mt-1">
                    {selectedEmail.contact_name && (
                      <span className="font-medium">
                        {selectedEmail.contact_name}{" "}
                      </span>
                    )}
                    <span className="text-dark-500">
                      &lt;{selectedEmail.contact_email}&gt;
                    </span>
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-dark-500 uppercase">
                    Subject
                  </label>
                  <p className="text-dark-900 font-medium mt-1">
                    {selectedEmail.subject}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-dark-500 uppercase">
                    Sent At
                  </label>
                  <p className="text-dark-700 mt-1">
                    {selectedEmail.sent_at
                      ? new Date(selectedEmail.sent_at).toLocaleString()
                      : "—"}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-dark-500 uppercase">
                    Body
                  </label>
                  <div className="mt-2 p-4 bg-dark-50 rounded-lg">
                    <pre className="whitespace-pre-wrap text-sm text-dark-700 font-sans">
                      {selectedEmail.body}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center">
              <MailOpenIcon className="w-12 h-12 mx-auto mb-4 text-dark-300" />
              <p className="text-dark-500">Select an email to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
    </svg>
  );
}

function MailOpenIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76"
      />
    </svg>
  );
}
