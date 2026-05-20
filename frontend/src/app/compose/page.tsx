"use client";

import { useEffect, useState } from "react";
import { getContacts, generateEmail, refineEmail, sendEmail, updateContact, researchCompany, Contact, CompanyContext } from "@/lib/api";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function ComposePage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [recipient, setRecipient] = useState({ email: "", name: "" });
  const [contentSource, setContentSource] = useState<"ai" | "manual">("ai");
  const [step, setStep] = useState(1);
  const [context, setContext] = useState({
    service: "",
    value_prop: "",
    tone: "professional",
  });
  const [email, setEmail] = useState({ subject: "", body: "" });
  const [sendIntervalSeconds, setSendIntervalSeconds] = useState(30);
  const [generating, setGenerating] = useState(false);
  const [refining, setRefining] = useState(false);
  const [sending, setSending] = useState(false);
  const [refineFeedback, setRefineFeedback] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [companyContext, setCompanyContext] = useState<CompanyContext | null>(null);
  const [researching, setResearching] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number; email: string } | null>(null);

  const selectedContacts = contacts.filter((contact) => selectedContactIds.includes(contact.id));
  const isBulkMode = selectedContacts.length > 1;
  const selectedContact = selectedContacts.length === 1 ? selectedContacts[0] : null;

  useEffect(() => {
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
    loadContacts();
  }, []);

  // Parse company_context when contact is selected
  useEffect(() => {
    if (selectedContact?.company_context) {
      try {
        setCompanyContext(JSON.parse(selectedContact.company_context));
      } catch {
        setCompanyContext(null);
      }
    } else {
      setCompanyContext(null);
    }
  }, [selectedContact]);

  useEffect(() => {
    setRecipient({
      email: selectedContact?.email || "",
      name: selectedContact?.name || "",
    });
  }, [selectedContact]);

  useEffect(() => {
    if (isBulkMode) {
      setCompanyContext(null);
    }
  }, [isBulkMode]);

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  function toggleContact(contactId: string) {
    setSelectedContactIds((current) =>
      current.includes(contactId)
        ? current.filter((id) => id !== contactId)
        : [...current, contactId]
    );
  }

  function handleSelectAll() {
    if (selectedContactIds.length === contacts.length) {
      setSelectedContactIds([]);
      return;
    }

    setSelectedContactIds(contacts.map((contact) => contact.id));
  }

  async function handleGenerate() {
    if (selectedContacts.length === 0) return;
    setGenerating(true);
    try {
      if (contentSource === "manual") {
        setStep(4);
        return;
      }

      if (isBulkMode) {
        setEmail({ subject: "", body: "" });
        setStep(4);
        return;
      }

      const result = await generateEmail({
        contact_id: selectedContact!.id,
        service: context.service,
        value_prop: context.value_prop,
        tone: context.tone,
      });
      setEmail(result);
      setStep(4);
    } catch (error: any) {
      showToast(error.message || "Failed to generate email", "error");
    } finally {
      setGenerating(false);
    }
  }

  async function handleResearch() {
    if (!selectedContact) return;
    setResearching(true);
    try {
      const result = await researchCompany(selectedContact.id);
      if (result.success && result.company_context) {
        const updatedCompanyContext = JSON.stringify(result.company_context);
        setCompanyContext(result.company_context);
        setContacts((current) =>
          current.map((contact) =>
            contact.id === selectedContact.id
              ? { ...contact, company_context: updatedCompanyContext }
              : contact
          )
        );
        showToast("Company researched successfully!", "success");
      } else {
        showToast(result.message || "Research returned no results", "error");
      }
    } catch (error: any) {
      showToast(error.message || "Failed to research company", "error");
    } finally {
      setResearching(false);
    }
  }

  async function handleSaveCompanyContext() {
    if (!selectedContact || !companyContext) return;
    try {
      const contextJson = JSON.stringify({
        ...companyContext,
        source: companyContext.source === 'auto_research' ? 'hybrid' : companyContext.source
      });
      await updateContact(selectedContact.id, {
        company_context: contextJson
      });
      setContacts((current) =>
        current.map((contact) =>
          contact.id === selectedContact.id
            ? { ...contact, company_context: contextJson }
            : contact
        )
      );
      showToast("Company info saved", "success");
    } catch (error: any) {
      showToast(error.message || "Failed to save", "error");
    }
  }

  async function handleRefine(feedback: string) {
    setRefining(true);
    try {
      const result = await refineEmail({
        subject: email.subject,
        body: email.body,
        feedback,
      });
      setEmail(result);
      setRefineFeedback("");
      showToast("Email refined successfully", "success");
    } catch (error: any) {
      showToast(error.message || "Failed to refine email", "error");
    } finally {
      setRefining(false);
    }
  }

  async function handleSend() {
    if (selectedContacts.length === 0) return;
    setSending(true);
    try {
      if (isBulkMode) {
        const errors: string[] = [];

        for (let index = 0; index < selectedContacts.length; index += 1) {
          const contact = selectedContacts[index];
          setBulkProgress({
            current: index + 1,
            total: selectedContacts.length,
            email: contact.email,
          });

          try {
            const message =
              contentSource === "manual"
                ? { subject: email.subject, body: email.body }
                : await generateEmail({
                    contact_id: contact.id,
                    service: context.service,
                    value_prop: context.value_prop,
                    tone: context.tone,
                  });

            await sendEmail({
              contact_id: contact.id,
              subject: message.subject,
              body: message.body,
              context: JSON.stringify({
                ...context,
                content_source: contentSource,
                send_interval_seconds: sendIntervalSeconds,
                bulk_send: true,
              }),
            });
          } catch (error: any) {
            errors.push(`${contact.email}: ${error.message || "Failed to send"}`);
          }

          if (index < selectedContacts.length - 1 && sendIntervalSeconds > 0) {
            await sleep(sendIntervalSeconds * 1000);
          }
        }

        setBulkProgress(null);

        if (errors.length > 0) {
          showToast(
            `Sent ${selectedContacts.length - errors.length}/${selectedContacts.length} emails. ${errors[0]}`,
            "error"
          );
        } else {
          showToast(`Sent ${selectedContacts.length} emails successfully`, "success");
        }

        setStep(1);
        setSelectedContactIds([]);
        setRecipient({ email: "", name: "" });
        setContentSource("ai");
        setContext({ service: "", value_prop: "", tone: "professional" });
        setEmail({ subject: "", body: "" });
        setCompanyContext(null);
        return;
      }

      await sendEmail({
        contact_id: selectedContact!.id,
        subject: email.subject,
        body: email.body,
        context: JSON.stringify(context),
        to_email: recipient.email || undefined,
        to_name: recipient.name || undefined,
      });
      showToast("Email sent successfully!", "success");
      // Reset form
      setStep(1);
      setSelectedContactIds([]);
      setRecipient({ email: "", name: "" });
      setContentSource("ai");
      setContext({ service: "", value_prop: "", tone: "professional" });
      setEmail({ subject: "", body: "" });
      setCompanyContext(null);
    } catch (error: any) {
      showToast(error.message || "Failed to send email", "error");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-dark-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-dark-900">Compose Email</h1>
        <p className="text-dark-500 mt-1">Generate AI-powered personalized cold emails individually or in bulk</p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { num: 1, label: "Select Contact" },
          { num: 2, label: "Company Info" },
          { num: 3, label: "Email Context" },
          { num: 4, label: "Review & Send" },
        ].map((s, i) => (
          <div key={s.num} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                step >= s.num
                  ? "bg-primary-600 text-white"
                  : "bg-dark-200 text-dark-500"
              }`}
            >
              {step > s.num ? "✓" : s.num}
            </div>
            <span
              className={`ml-2 text-sm font-medium ${
                step >= s.num ? "text-dark-900" : "text-dark-400"
              }`}
            >
              {s.label}
            </span>
            {i < 3 && (
              <div
                className={`w-8 h-0.5 mx-2 ${
                  step > s.num ? "bg-primary-600" : "bg-dark-200"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="card p-6">
        {/* Step 1: Select Contact */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-dark-900">Select Contact(s)</h2>
                <p className="text-sm text-dark-500 mt-1">
                  Pick one contact for preview/refine, or multiple contacts for bulk sending.
                </p>
              </div>
              {contacts.length > 0 && (
                <button onClick={handleSelectAll} className="btn btn-secondary">
                  {selectedContactIds.length === contacts.length ? "Clear All" : "Select All"}
                </button>
              )}
            </div>
            {contacts.length === 0 ? (
              <div className="text-center py-8">
                <UsersIcon className="w-12 h-12 mx-auto mb-4 text-dark-300" />
                <p className="text-dark-500">No contacts yet</p>
                <a
                  href="/contacts"
                  className="text-primary-600 hover:text-primary-700 mt-2 inline-block"
                >
                  Add contacts first
                </a>
              </div>
            ) : (
              <>
                <div className="grid gap-3 max-h-96 overflow-y-auto">
                  {contacts.map((contact) => (
                    <button
                      key={contact.id}
                      onClick={() => toggleContact(contact.id)}
                      className={`w-full text-left p-4 rounded-lg border transition-all ${
                        selectedContactIds.includes(contact.id)
                          ? "border-primary-500 bg-primary-50"
                          : "border-dark-200 hover:border-primary-300"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selectedContactIds.includes(contact.id)}
                          onChange={() => toggleContact(contact.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-1 h-4 w-4 rounded border-dark-300 text-primary-600 focus:ring-primary-500"
                        />
                        <div>
                          <div className="font-medium text-dark-900">{contact.email}</div>
                          {(contact.name || contact.company) && (
                            <div className="text-sm text-dark-500 mt-1">
                              {contact.name}
                              {contact.name && contact.company && " • "}
                              {contact.company}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                {selectedContactIds.length > 0 && (
                  <div className="rounded-lg bg-primary-50 border border-primary-100 px-4 py-3 text-sm text-primary-800">
                    {selectedContactIds.length} contact{selectedContactIds.length === 1 ? "" : "s"} selected
                  </div>
                )}
                <div className="flex justify-end pt-4">
                  <button
                    onClick={() => setStep(2)}
                    disabled={selectedContactIds.length === 0}
                    className="btn btn-primary"
                  >
                    Continue
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 2: Company Info */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-dark-900">Company Information</h2>
              <div className="text-sm text-dark-500">
                {isBulkMode ? `${selectedContacts.length} contacts selected` : (selectedContact?.company || "No company set")}
              </div>
            </div>

            {isBulkMode ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                <p className="text-blue-900 font-medium">Bulk mode uses each contact&apos;s saved details.</p>
                <p className="text-blue-800 text-sm">
                  Company research and manual company edits are available only when exactly one contact is selected.
                </p>
              </div>
            ) : !selectedContact?.company ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-800">
                  No company name set for this contact. You can still proceed or go back to add company info to the contact.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Auto-research button */}
                <div className="bg-gradient-to-r from-primary-50 to-cyan-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-dark-900">AI Company Research</h3>
                      <p className="text-sm text-dark-500">
                        Automatically fetch company info from the web
                      </p>
                    </div>
                    <button
                      onClick={handleResearch}
                      disabled={researching}
                      className="btn btn-primary"
                    >
                      {researching ? (
                        <>
                          <SpinnerIcon className="w-4 h-4 mr-2 animate-spin" />
                          Researching...
                        </>
                      ) : (
                        <>
                          <SearchIcon className="w-4 h-4 mr-2" />
                          Research Company
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Company context form */}
                <div className="border border-dark-200 rounded-lg p-4 space-y-4">
                  <h3 className="font-medium text-dark-900">Company Details</h3>

                  <div>
                    <label className="label">Description</label>
                    <textarea
                      value={companyContext?.description || ""}
                      onChange={(e) => setCompanyContext({
                        ...companyContext,
                        description: e.target.value,
                        source: companyContext?.source === 'auto_research' ? 'hybrid' : (companyContext?.source || 'manual')
                      } as CompanyContext)}
                      className="textarea h-20"
                      placeholder="Brief description of the company..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Industry</label>
                      <input
                        type="text"
                        value={companyContext?.industry || ""}
                        onChange={(e) => setCompanyContext({
                          ...companyContext,
                          industry: e.target.value,
                          source: companyContext?.source === 'auto_research' ? 'hybrid' : (companyContext?.source || 'manual')
                        } as CompanyContext)}
                        className="input"
                        placeholder="e.g., Technology"
                      />
                    </div>
                    <div>
                      <label className="label">Company Size</label>
                      <select
                        value={companyContext?.size || ""}
                        onChange={(e) => setCompanyContext({
                          ...companyContext,
                          size: e.target.value,
                          source: companyContext?.source === 'auto_research' ? 'hybrid' : (companyContext?.source || 'manual')
                        } as CompanyContext)}
                        className="select"
                      >
                        <option value="">Select size...</option>
                        <option value="1-10">1-10 employees</option>
                        <option value="11-50">11-50 employees</option>
                        <option value="51-200">51-200 employees</option>
                        <option value="201-500">201-500 employees</option>
                        <option value="501-1000">501-1000 employees</option>
                        <option value="1000+">1000+ employees</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="label">Products/Services</label>
                    <input
                      type="text"
                      value={companyContext?.products_services || ""}
                      onChange={(e) => setCompanyContext({
                        ...companyContext,
                        products_services: e.target.value,
                        source: companyContext?.source === 'auto_research' ? 'hybrid' : (companyContext?.source || 'manual')
                      } as CompanyContext)}
                      className="input"
                      placeholder="Main products or services..."
                    />
                  </div>

                  <div>
                    <label className="label">Recent News</label>
                    <input
                      type="text"
                      value={companyContext?.recent_news || ""}
                      onChange={(e) => setCompanyContext({
                        ...companyContext,
                        recent_news: e.target.value,
                        source: companyContext?.source === 'auto_research' ? 'hybrid' : (companyContext?.source || 'manual')
                      } as CompanyContext)}
                      className="input"
                      placeholder="Recent funding, launches, news..."
                    />
                  </div>

                  <div>
                    <label className="label">Additional Notes</label>
                    <textarea
                      value={companyContext?.additional_notes || ""}
                      onChange={(e) => setCompanyContext({
                        ...companyContext,
                        additional_notes: e.target.value,
                        source: companyContext?.source === 'auto_research' ? 'hybrid' : (companyContext?.source || 'manual')
                      } as CompanyContext)}
                      className="textarea"
                      placeholder="Any other relevant info you want to include..."
                    />
                  </div>

                  {companyContext && (
                    <div className="flex items-center justify-between pt-2 border-t border-dark-100">
                      <span className="text-xs text-dark-400">
                        Source: {companyContext.source || 'manual'}
                        {companyContext.researched_at &&
                          ` | Last updated: ${new Date(companyContext.researched_at).toLocaleDateString()}`
                        }
                      </span>
                      <button
                        onClick={handleSaveCompanyContext}
                        className="text-sm text-primary-600 hover:text-primary-700"
                      >
                        Save to contact
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-between pt-4">
              <button onClick={() => setStep(1)} className="btn btn-secondary">
                Back
              </button>
              <button onClick={() => setStep(3)} className="btn btn-primary">
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Email Context */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-dark-900">Email Context</h2>
              <div className="text-sm text-dark-500">
                {isBulkMode
                  ? `Recipients: ${selectedContacts.length}`
                  : `To: ${recipient.email || selectedContact?.email}`}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label">Content Source</label>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setContentSource("ai")}
                    className={`rounded-lg border p-4 text-left transition-all ${
                      contentSource === "ai"
                        ? "border-primary-500 bg-primary-50"
                        : "border-dark-200 hover:border-primary-300"
                    }`}
                  >
                    <div className="font-medium text-dark-900">AI Generate</div>
                    <div className="text-sm text-dark-500 mt-1">
                      Use service, value prop, and tone to generate the email.
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setContentSource("manual")}
                    className={`rounded-lg border p-4 text-left transition-all ${
                      contentSource === "manual"
                        ? "border-primary-500 bg-primary-50"
                        : "border-dark-200 hover:border-primary-300"
                    }`}
                  >
                    <div className="font-medium text-dark-900">Write Manually</div>
                    <div className="text-sm text-dark-500 mt-1">
                      Provide your own subject and body and send that directly.
                    </div>
                  </button>
                </div>
              </div>

              {!isBulkMode ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="label">Recipient Email *</label>
                    <input
                      type="email"
                      value={recipient.email}
                      onChange={(e) => setRecipient({ ...recipient, email: e.target.value })}
                      className="input"
                      placeholder="runbyte.tech@gmail.com"
                    />
                  </div>
                  <div>
                    <label className="label">Recipient Name</label>
                    <input
                      type="text"
                      value={recipient.name}
                      onChange={(e) => setRecipient({ ...recipient, name: e.target.value })}
                      className="input"
                      placeholder="Optional recipient name"
                    />
                  </div>
                </div>
              ) : (
                <div className="rounded-lg bg-dark-50 border border-dark-200 px-4 py-3 text-sm text-dark-600">
                  Bulk mode sends to each selected contact&apos;s saved email address.
                </div>
              )}
              {contentSource === "ai" ? (
                <>
                  <div>
                    <label className="label">Service/Product you&apos;re selling *</label>
                    <input
                      type="text"
                      value={context.service}
                      onChange={(e) => setContext({ ...context, service: e.target.value })}
                      className="input"
                      placeholder="e.g., AI-powered analytics platform"
                    />
                  </div>
                  <div>
                    <label className="label">Value Proposition *</label>
                    <textarea
                      value={context.value_prop}
                      onChange={(e) => setContext({ ...context, value_prop: e.target.value })}
                      className="textarea h-24"
                      placeholder="e.g., Help companies reduce churn by 30% through predictive insights"
                    />
                  </div>
                  <div>
                    <label className="label">Tone</label>
                    <select
                      value={context.tone}
                      onChange={(e) => setContext({ ...context, tone: e.target.value })}
                      className="select"
                    >
                      <option value="professional">Professional</option>
                      <option value="friendly">Friendly</option>
                      <option value="casual">Casual</option>
                      <option value="formal">Formal</option>
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="label">Subject *</label>
                    <input
                      type="text"
                      value={email.subject}
                      onChange={(e) => setEmail({ ...email, subject: e.target.value })}
                      className="input"
                      placeholder="Write your subject"
                    />
                  </div>
                  <div>
                    <label className="label">Body *</label>
                    <textarea
                      value={email.body}
                      onChange={(e) => setEmail({ ...email, body: e.target.value })}
                      className="textarea h-40"
                      placeholder="Write your email body"
                    />
                  </div>
                </>
              )}
              <div>
                <label className="label">Interval Gap Between Emails (seconds)</label>
                <input
                  type="number"
                  min="0"
                  value={sendIntervalSeconds}
                  onChange={(e) => setSendIntervalSeconds(Math.max(0, Number(e.target.value) || 0))}
                  className="input"
                  placeholder="30"
                />
                <p className="text-xs text-dark-500 mt-2">
                  Used for bulk sending. `0` sends one after another without waiting.
                </p>
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <button onClick={() => setStep(2)} className="btn btn-secondary">
                Back
              </button>
              <button
                onClick={handleGenerate}
                disabled={
                  (!isBulkMode && !recipient.email) ||
                  (contentSource === "ai"
                    ? !context.service || !context.value_prop
                    : !email.subject || !email.body) ||
                  generating
                }
                className="btn btn-primary"
              >
                {generating ? (
                  <>
                    <SpinnerIcon className="w-4 h-4 mr-2 animate-spin" />
                    {contentSource === "manual" ? "Preparing..." : isBulkMode ? "Preparing..." : "Generating..."}
                  </>
                ) : (
                  <>
                    <SparklesIcon className="w-4 h-4 mr-2" />
                    {contentSource === "manual"
                      ? "Continue to Review"
                      : isBulkMode
                        ? "Continue to Bulk Send"
                        : "Generate Email"}
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Review & Send */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-dark-900">Review & Send</h2>
              <div className="text-sm text-dark-500">
                {isBulkMode
                  ? `${selectedContacts.length} recipients • ${sendIntervalSeconds}s gap`
                  : `To: ${recipient.name ? `${recipient.name} <${recipient.email}>` : recipient.email}`}
              </div>
            </div>

            {isBulkMode ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-dark-200 bg-dark-50 p-4">
                  <h3 className="font-medium text-dark-900">Bulk send summary</h3>
                  <p className="text-sm text-dark-600 mt-2">
                    {contentSource === "manual"
                      ? "The same subject and body will be sent to every selected recipient."
                      : "Each email will be AI-generated and sent individually using the context you provided."}
                  </p>
                  <p className="text-sm text-dark-600 mt-2">
                    Total recipients: {selectedContacts.length}
                  </p>
                  <p className="text-sm text-dark-600">
                    Interval gap: {sendIntervalSeconds} second{sendIntervalSeconds === 1 ? "" : "s"}
                  </p>
                </div>

                {contentSource === "manual" && (
                  <div className="border border-dark-200 rounded-lg overflow-hidden">
                    <div className="bg-dark-50 px-4 py-3 border-b border-dark-200">
                      <label className="text-xs font-medium text-dark-500 uppercase">Subject</label>
                      <input
                        type="text"
                        value={email.subject}
                        onChange={(e) => setEmail({ ...email, subject: e.target.value })}
                        className="w-full bg-transparent border-none text-dark-900 font-medium focus:outline-none mt-1"
                      />
                    </div>
                    <div className="p-4">
                      <label className="text-xs font-medium text-dark-500 uppercase">Body</label>
                      <textarea
                        value={email.body}
                        onChange={(e) => setEmail({ ...email, body: e.target.value })}
                        className="w-full bg-transparent border-none text-dark-700 focus:outline-none mt-2 min-h-[200px] resize-none"
                      />
                    </div>
                  </div>
                )}

                <div className="border border-dark-200 rounded-lg p-4">
                  <label className="text-xs font-medium text-dark-500 uppercase">Recipients</label>
                  <div className="mt-3 max-h-64 overflow-y-auto space-y-2">
                    {selectedContacts.map((contact) => (
                      <div key={contact.id} className="flex items-center justify-between rounded-lg bg-white border border-dark-100 px-3 py-2 text-sm">
                        <span className="text-dark-900">{contact.email}</span>
                        <span className="text-dark-500">{contact.name || contact.company || "—"}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {bulkProgress && (
                  <div className="rounded-lg border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-800">
                    Sending {bulkProgress.current}/{bulkProgress.total}: {bulkProgress.email}
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Email Preview */}
                <div className="border border-dark-200 rounded-lg overflow-hidden">
                  <div className="bg-dark-50 px-4 py-3 border-b border-dark-200">
                    <label className="text-xs font-medium text-dark-500 uppercase">Subject</label>
                    <input
                      type="text"
                      value={email.subject}
                      onChange={(e) => setEmail({ ...email, subject: e.target.value })}
                      className="w-full bg-transparent border-none text-dark-900 font-medium focus:outline-none mt-1"
                    />
                  </div>
                  <div className="p-4">
                    <label className="text-xs font-medium text-dark-500 uppercase">Body</label>
                    <textarea
                      value={email.body}
                      onChange={(e) => setEmail({ ...email, body: e.target.value })}
                      className="w-full bg-transparent border-none text-dark-700 focus:outline-none mt-2 min-h-[200px] resize-none"
                    />
                  </div>
                </div>

                {/* Refine Panel */}
                <div className="bg-gradient-to-r from-primary-50 to-cyan-50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-dark-900 mb-3">
                    <SparklesIcon className="w-4 h-4 inline mr-2 text-primary-600" />
                    AI Refinement
                  </h3>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {["Make it shorter", "More formal", "Add urgency", "More friendly"].map(
                      (suggestion) => (
                        <button
                          key={suggestion}
                          onClick={() => handleRefine(suggestion)}
                          disabled={refining}
                          className="px-3 py-1.5 text-sm bg-white rounded-full border border-dark-200 text-dark-700 hover:border-primary-300 hover:bg-primary-50 transition-all"
                        >
                          {suggestion}
                        </button>
                      )
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={refineFeedback}
                      onChange={(e) => setRefineFeedback(e.target.value)}
                      placeholder="Custom feedback..."
                      className="input flex-1"
                    />
                    <button
                      onClick={() => handleRefine(refineFeedback)}
                      disabled={!refineFeedback || refining}
                      className="btn btn-secondary"
                    >
                      {refining ? "Refining..." : "Refine"}
                    </button>
                  </div>
                </div>
              </>
            )}

            <div className="flex justify-between pt-4">
              <button onClick={() => setStep(3)} className="btn btn-secondary">
                Back
              </button>
              <button
                onClick={handleSend}
                disabled={
                  sending ||
                  (isBulkMode
                    ? selectedContacts.length === 0 || (contentSource === "manual" && (!email.subject || !email.body))
                    : (!recipient.email || !email.subject || !email.body))
                }
                className="btn btn-primary"
              >
                {sending ? (
                  <>
                    <SpinnerIcon className="w-4 h-4 mr-2 animate-spin" />
                    {isBulkMode ? "Sending Bulk Emails..." : "Sending..."}
                  </>
                ) : (
                  <>
                    <SendIcon className="w-4 h-4 mr-2" />
                    {isBulkMode ? `Send ${selectedContacts.length} Emails` : "Send Email"}
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`toast ${toast.type === "success" ? "toast-success" : "toast-error"}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

// Icons
function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
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

function SendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
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
