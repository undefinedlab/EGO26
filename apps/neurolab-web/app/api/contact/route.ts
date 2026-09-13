import { mkdir, appendFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const TOPICS = new Set([
  "general",
  "workbench",
  "verification",
  "partnership",
  "security",
  "press",
]);

type ContactBody = {
  name?: unknown;
  email?: unknown;
  topic?: unknown;
  message?: unknown;
  company?: unknown;
};

function asTrimmed(value: unknown, max: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

export async function POST(req: Request) {
  let body: ContactBody;
  try {
    body = (await req.json()) as ContactBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const name = asTrimmed(body.name, 120);
  const email = asTrimmed(body.email, 254).toLowerCase();
  const topic = asTrimmed(body.topic, 40) || "general";
  const message = asTrimmed(body.message, 8000);
  const company = asTrimmed(body.company, 160);

  if (name.length < 2) {
    return NextResponse.json({ error: "Please include your name." }, { status: 400 });
  }
  if (!validEmail(email)) {
    return NextResponse.json({ error: "Please include a valid email address." }, { status: 400 });
  }
  if (!TOPICS.has(topic)) {
    return NextResponse.json({ error: "Unknown topic." }, { status: 400 });
  }
  if (message.length < 20) {
    return NextResponse.json({ error: "Message should be at least 20 characters." }, { status: 400 });
  }

  const record = {
    id: `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    receivedAt: new Date().toISOString(),
    name,
    email,
    topic,
    company: company || null,
    message,
    userAgent: req.headers.get("user-agent")?.slice(0, 240) ?? null,
  };

  const dataDir = path.join(process.cwd(), ".data");
  await mkdir(dataDir, { recursive: true });
  await appendFile(path.join(dataDir, "contact-messages.jsonl"), `${JSON.stringify(record)}\n`, "utf8");

  const webhook = process.env.CONTACT_WEBHOOK_URL?.trim();
  if (webhook) {
    try {
      await fetch(webhook, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: `SynapseVM contact · ${topic}\n${name} <${email}>\n\n${message}`,
          ...record,
        }),
      });
    } catch {
      // Local inbox already persisted; webhook failure should not fail the user.
    }
  }

  return NextResponse.json({
    ok: true,
    id: record.id,
    message: "Thanks — we received your note and will reply by email.",
  });
}
