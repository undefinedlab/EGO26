"use client";

import { useState, type FormEvent } from "react";

export function ContactForm() {
  const [sent, setSent] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSent(true);
  }

  if (sent) {
    return (
      <div className="site-success" role="status">
        <p className="kicker kicker-accent">Mock received</p>
        <h2>Thanks — this form does not send mail.</h2>
        <p className="muted">
          Your note stays in this browser session. NeuroLab is not wired to an inbox
          yet, so nothing left the page.
        </p>
        <p className="t-sm subtle">
          {name || "Someone"} · {email || "no email"}
        </p>
      </div>
    );
  }

  return (
    <form className="stack-6" onSubmit={onSubmit} noValidate={false}>
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
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ada Lovelace"
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
        />
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
          rows={6}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="What are you composing, simulating, or trying to verify?"
        />
        <p className="field-hint">UI mock — submit stays on this page.</p>
      </div>
      <button type="submit" className="btn btn-primary">
        Send mock note
      </button>
    </form>
  );
}
