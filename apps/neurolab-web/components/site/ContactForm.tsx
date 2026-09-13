"use client";

import { useState, type FormEvent } from "react";

const TOPICS = [
  { value: "general", label: "General question" },
  { value: "workbench", label: "Workbench / Compose" },
  { value: "verification", label: "Verify / receipts / partners" },
  { value: "partnership", label: "Partnership or integration" },
  { value: "security", label: "Security disclosure" },
  { value: "press", label: "Press / research" },
] as const;

export function ContactForm() {
  const [sentId, setSentId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [topic, setTopic] = useState<string>("general");
  const [message, setMessage] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email, company, topic, message }),
      });
      const json = (await res.json()) as { error?: string; id?: string; message?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not send your message.");
      setSentId(json.id ?? "ok");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (sentId) {
    return (
      <div className="site-success" role="status">
        <p className="kicker kicker-accent">Message received</p>
        <h2>Thanks — we will reply by email.</h2>
        <p className="muted">
          Your note was stored on this NeuroLab instance. Reference{" "}
          <span className="mono">{sentId}</span>.
        </p>
        <p className="t-sm subtle">
          {name} · {email}
        </p>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            setSentId(null);
            setMessage("");
          }}
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form className="stack-6" onSubmit={(e) => void onSubmit(e)}>
      <div className="field">
        <label className="field-label" htmlFor="contact-name">
          Name
        </label>
        <input
          id="contact-name"
          className="input"
          name="name"
          autoComplete="name"
          required
          minLength={2}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ada Lovelace"
          disabled={busy}
        />
      </div>
      <div className="field">
        <label className="field-label" htmlFor="contact-email">
          Email
        </label>
        <input
          id="contact-email"
          className="input"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@lab.example"
          disabled={busy}
        />
      </div>
      <div className="field">
        <label className="field-label" htmlFor="contact-company">
          Organization <span className="subtle">(optional)</span>
        </label>
        <input
          id="contact-company"
          className="input"
          name="company"
          autoComplete="organization"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Lab or company"
          disabled={busy}
        />
      </div>
      <div className="field">
        <label className="field-label" htmlFor="contact-topic">
          Topic
        </label>
        <select
          id="contact-topic"
          className="input"
          name="topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          disabled={busy}
        >
          {TOPICS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label className="field-label" htmlFor="contact-message">
          Message
        </label>
        <textarea
          id="contact-message"
          className="textarea"
          name="message"
          required
          minLength={20}
          rows={7}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="What are you building, verifying, or hoping to integrate?"
          disabled={busy}
        />
        <p className="field-hint">We read every note. Security disclosures: choose the Security topic.</p>
      </div>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
