"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getContacts, getEmails, Contact, Email } from "@/lib/api";

export default function Dashboard() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [contactsData, emailsData] = await Promise.all([
          getContacts(),
          getEmails(),
        ]);
        setContacts(contactsData);
        setEmails(emailsData);
      } catch (error) {
        console.error("Failed to load data:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const sentEmails = emails.filter((e) => e.status === "sent");
  const recentEmails = sentEmails.slice(0, 5);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-dark-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-dark-900">Dashboard</h1>
        <p className="text-dark-500 mt-1">Welcome back! Here&apos;s your cold email overview.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Total Contacts"
          value={contacts.length}
          icon={<UsersIcon />}
          color="primary"
          href="/contacts"
        />
        <StatCard
          title="Emails Sent"
          value={sentEmails.length}
          icon={<MailIcon />}
          color="green"
          href="/history"
        />
        <StatCard
          title="Ready to Compose"
          value={contacts.length > 0 ? "Start" : "Add Contacts"}
          icon={<PenIcon />}
          color="purple"
          href="/compose"
          isAction
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Emails */}
        <div className="card">
          <div className="px-6 py-4 border-b border-dark-100 flex items-center justify-between">
            <h2 className="font-semibold text-dark-900">Recent Emails</h2>
            <Link href="/history" className="text-sm text-primary-600 hover:text-primary-700">
              View all
            </Link>
          </div>
          <div className="divide-y divide-dark-100">
            {recentEmails.length === 0 ? (
              <div className="px-6 py-8 text-center text-dark-500">
                <MailIcon className="w-12 h-12 mx-auto mb-3 text-dark-300" />
                <p>No emails sent yet</p>
                <Link href="/compose" className="text-primary-600 hover:text-primary-700 text-sm mt-2 inline-block">
                  Compose your first email
                </Link>
              </div>
            ) : (
              recentEmails.map((email) => (
                <div key={email.id} className="px-6 py-4 hover:bg-dark-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-dark-900 truncate">{email.subject}</p>
                      <p className="text-sm text-dark-500 mt-1">
                        To: {email.contact_name || email.contact_email}
                      </p>
                    </div>
                    <span className="text-xs text-dark-400 ml-4">
                      {email.sent_at ? new Date(email.sent_at).toLocaleDateString() : ""}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Start */}
        <div className="card">
          <div className="px-6 py-4 border-b border-dark-100">
            <h2 className="font-semibold text-dark-900">Quick Start</h2>
          </div>
          <div className="p-6 space-y-4">
            <QuickAction
              step={1}
              title="Configure Settings"
              description="Add your Gmail credentials and Gemini API key"
              href="/settings"
              done={false}
            />
            <QuickAction
              step={2}
              title="Add Contacts"
              description="Upload a CSV or add contacts manually"
              href="/contacts"
              done={contacts.length > 0}
            />
            <QuickAction
              step={3}
              title="Compose Email"
              description="Use AI to generate personalized cold emails"
              href="/compose"
              done={sentEmails.length > 0}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  color,
  href,
  isAction,
}: {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: "primary" | "green" | "purple";
  href: string;
  isAction?: boolean;
}) {
  const colorClasses = {
    primary: "bg-primary-50 text-primary-600",
    green: "bg-green-50 text-green-600",
    purple: "bg-purple-50 text-purple-600",
  };

  return (
    <Link href={href} className="card card-hover p-6 group">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-dark-500">{title}</p>
          <p className={`text-3xl font-bold mt-2 ${isAction ? "text-lg" : ""} text-dark-900`}>
            {value}
          </p>
        </div>
        <div className={`w-12 h-12 rounded-xl ${colorClasses[color]} flex items-center justify-center group-hover:scale-110 transition-transform`}>
          {icon}
        </div>
      </div>
    </Link>
  );
}

function QuickAction({
  step,
  title,
  description,
  href,
  done,
}: {
  step: number;
  title: string;
  description: string;
  href: string;
  done: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-start gap-4 p-4 rounded-lg border transition-all ${
        done
          ? "border-green-200 bg-green-50/50"
          : "border-dark-200 hover:border-primary-300 hover:bg-primary-50/50"
      }`}
    >
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
          done ? "bg-green-500 text-white" : "bg-dark-200 text-dark-600"
        }`}
      >
        {done ? "✓" : step}
      </div>
      <div>
        <p className="font-medium text-dark-900">{title}</p>
        <p className="text-sm text-dark-500 mt-0.5">{description}</p>
      </div>
    </Link>
  );
}

function UsersIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function MailIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

function PenIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
  );
}
