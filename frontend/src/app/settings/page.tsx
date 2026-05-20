"use client";

import { useEffect, useState } from "react";
import { getSettings, updateSettings, testGmailConnection, Settings } from "@/lib/api";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const data = await getSettings();
        setSettings(data);
      } catch (error) {
        showToast("Failed to load settings", "error");
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  function showToast(message: string, type: "success" | "error" | "info") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;

    setSaving(true);
    try {
      const updated = await updateSettings(settings);
      setSettings(updated);
      showToast("Settings saved successfully", "success");
    } catch (error) {
      showToast("Failed to save settings", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleTestGmail() {
    if (!settings) return;
    
    setTesting(true);
    try {
      // Test with current form values (not saved values)
      const result = await testGmailConnection({
        gmail_email: settings.gmail_email,
        gmail_app_password: settings.gmail_app_password,
      });
      if (result.success) {
        showToast(result.message, "success");
      } else {
        showToast(result.message, "error");
      }
    } catch (error) {
      showToast("Connection test failed", "error");
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-dark-500">Loading...</div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="text-center py-12">
        <p className="text-dark-500">Failed to load settings</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-dark-900">Settings</h1>
        <p className="text-dark-500 mt-1">Configure your email and AI credentials</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Gmail Settings */}
        <div className="card">
          <div className="px-6 py-4 border-b border-dark-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                <GmailIcon className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h2 className="font-semibold text-dark-900">Gmail Configuration</h2>
                <p className="text-sm text-dark-500">Connect your Gmail account for sending emails</p>
              </div>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="label">Gmail Email Address</label>
              <input
                type="email"
                value={settings.gmail_email}
                onChange={(e) => setSettings({ ...settings, gmail_email: e.target.value })}
                className="input"
                placeholder="your.email@gmail.com"
              />
            </div>
            <div>
              <label className="label">App Password</label>
              <input
                type="password"
                value={settings.gmail_app_password}
                onChange={(e) => setSettings({ ...settings, gmail_app_password: e.target.value })}
                className="input"
                placeholder="Enter app password"
              />
              <p className="text-xs text-dark-500 mt-2">
                Generate an app password at{" "}
                <a
                  href="https://myaccount.google.com/apppasswords"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:text-primary-700"
                >
                  myaccount.google.com/apppasswords
                </a>
              </p>
            </div>
            <div>
              <label className="label">Sender Display Name</label>
              <input
                type="text"
                value={settings.sender_name}
                onChange={(e) => setSettings({ ...settings, sender_name: e.target.value })}
                className="input"
                placeholder="John Doe"
              />
            </div>
            <div>
              <label className="label">Email Signature</label>
              <textarea
                value={settings.signature}
                onChange={(e) => setSettings({ ...settings, signature: e.target.value })}
                className="textarea h-24"
                placeholder="Best regards,&#10;John Doe&#10;CEO, Acme Inc."
              />
            </div>
            <button
              type="button"
              onClick={handleTestGmail}
              disabled={testing || !settings.gmail_email || !settings.gmail_app_password}
              className="btn btn-secondary"
            >
              {testing ? "Testing..." : "Test Connection"}
            </button>
          </div>
        </div>

        {/* Gemini Settings */}
        <div className="card">
          <div className="px-6 py-4 border-b border-dark-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <SparklesIcon className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="font-semibold text-dark-900">Gemini AI Configuration</h2>
                <p className="text-sm text-dark-500">Configure your Google Gemini API for AI-powered emails</p>
              </div>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="label">Gemini API Key</label>
              <input
                type="password"
                value={settings.gemini_api_key}
                onChange={(e) => setSettings({ ...settings, gemini_api_key: e.target.value })}
                className="input"
                placeholder="Enter API key"
              />
              <p className="text-xs text-dark-500 mt-2">
                Get your API key from{" "}
                <a
                  href="https://makersuite.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:text-primary-700"
                >
                  Google AI Studio
                </a>
              </p>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </form>

      {/* Toast */}
      {toast && (
        <div
          className={`toast ${
            toast.type === "success"
              ? "toast-success"
              : toast.type === "error"
              ? "toast-error"
              : "toast-info"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

function GmailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" />
    </svg>
  );
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  );
}
