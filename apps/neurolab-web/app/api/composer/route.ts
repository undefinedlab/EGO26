import { NextResponse } from "next/server";
import { extractLocal, respond, type Extraction } from "@/lib/composer/dialogue";
import { emptySpec, type BuildSpec } from "@/lib/composer/spec";

/**
 * The Composer endpoint.
 *
 * A model, when one is configured, does exactly one job: read what the user
 * said and fill in a BuildSpec. It never emits a graph. Wiring is synthesised
 * deterministically and validated by the same compiler that guards manual
 * editing, so a hallucinated block or an illegal port cannot reach the canvas.
 *
 * Configure with SYNAPSEVM_LLM_URL, SYNAPSEVM_LLM_KEY and SYNAPSEVM_LLM_MODEL.
 * With none set the route answers from the local vocabulary extractor and says
 * so in the response, so the UI can be honest about which one replied.
 */

export const dynamic = "force-dynamic";

const SCHEMA_HINT = `Return ONLY a JSON object with these optional keys:
{
  "platform": "ground-robot" | "drone" | "vehicle" | "arm" | "gantry" | "camera",
  "sensors": ("camera" | "simulator" | "imu")[],
  "capabilities": ("collision-avoidance" | "nominal-steering" | "emergency-brake" | "steering-limit" | "course-holding" | "drift-correction" | "target-following")[],
  "deadlineMs": number
}
Omit any key the user did not indicate. Do not invent capabilities that were not asked for.`;

const CAPS = [
  "collision-avoidance",
  "nominal-steering",
  "emergency-brake",
  "steering-limit",
  "course-holding",
  "drift-correction",
  "target-following",
];
const PLATFORMS = ["ground-robot", "drone", "vehicle", "arm", "gantry", "camera"];
const SENSORS = ["camera", "simulator", "imu"];

/** Never trust the model's shape — keep only values the planner understands. */
function sanitise(raw: unknown): Extraction {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const out: Extraction = {};

  if (typeof r.platform === "string" && PLATFORMS.includes(r.platform)) {
    out.platform = r.platform as Extraction["platform"];
  }
  if (Array.isArray(r.sensors)) {
    const s = r.sensors.filter((x): x is string => typeof x === "string" && SENSORS.includes(x));
    if (s.length) out.sensors = s as Extraction["sensors"];
  }
  if (Array.isArray(r.capabilities)) {
    const c = r.capabilities.filter((x): x is string => typeof x === "string" && CAPS.includes(x));
    if (c.length) out.capabilities = c as Extraction["capabilities"];
  }
  if (typeof r.deadlineMs === "number" && Number.isFinite(r.deadlineMs) && r.deadlineMs > 0 && r.deadlineMs <= 1000) {
    out.deadlineMs = r.deadlineMs;
  }
  return out;
}

async function extractWithModel(text: string): Promise<Extraction | null> {
  const url = process.env.SYNAPSEVM_LLM_URL;
  const key = process.env.SYNAPSEVM_LLM_KEY;
  const model = process.env.SYNAPSEVM_LLM_MODEL;
  if (!url || !key || !model) return null;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        max_tokens: 400,
        messages: [
          { role: "system", content: `You extract a build specification for a spiking-neural-network control stack. ${SCHEMA_HINT}` },
          { role: "user", content: text.slice(0, 4000) },
        ],
      }),
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;

    const body = (await res.json()) as Record<string, unknown>;
    // Accept either an OpenAI-style or Anthropic-style envelope.
    const content =
      (body as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content ??
      (body as { content?: { text?: string }[] }).content?.[0]?.text ??
      "";
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return sanitise(JSON.parse(match[0]));
  } catch {
    // A model failure must never break the Composer — fall through to local.
    return null;
  }
}

export async function POST(request: Request) {
  let payload: { spec?: BuildSpec; message?: string };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const message = typeof payload.message === "string" ? payload.message : "";
  if (!message.trim()) return NextResponse.json({ error: "Empty message" }, { status: 400 });

  const spec: BuildSpec = payload.spec ?? emptySpec();

  const fromModel = await extractWithModel(message);
  const source = fromModel ? "model" : "local";
  const extractor = fromModel ? () => fromModel : extractLocal;

  const { spec: nextSpec, turn } = respond(spec, message, extractor);

  return NextResponse.json({ source, spec: nextSpec, turn });
}

export async function GET() {
  const configured = Boolean(
    process.env.SYNAPSEVM_LLM_URL && process.env.SYNAPSEVM_LLM_KEY && process.env.SYNAPSEVM_LLM_MODEL,
  );
  return NextResponse.json({ configured });
}
