import { NextRequest, NextResponse } from "next/server";
import { creMode, runCreVerification } from "@/lib/creRunner";
import { resolveCreGatewayConfig } from "@/lib/creGateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HASH = /^sha256:[a-f0-9]{64}$/;

export async function GET() {
  const mode = creMode();
  if (mode === "simulation") {
    return NextResponse.json({ mode, ready: true, trust: "local-simulation" }, { headers: { "Cache-Control": "no-store" } });
  }
  try {
    const resolved = resolveCreGatewayConfig();
    return NextResponse.json({
      mode,
      ready: Boolean(resolved.value),
      missing: resolved.missing,
      trust: "production-don",
    }, { status: resolved.value ? 200 : 503, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({
      mode,
      ready: false,
      trust: "production-don",
      error: error instanceof Error ? error.message : String(error),
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().startsWith("application/json")) {
      return NextResponse.json({ error: "Content-Type must be application/json." }, { status: 415 });
    }
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (origin) {
      try {
        if (new URL(origin).host !== host) {
          return NextResponse.json({ error: "Cross-origin CRE request rejected." }, { status: 403 });
        }
      } catch {
        return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
      }
    }
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > 250_000) {
      return NextResponse.json({ error: "CRE request exceeds 250 KB." }, { status: 413 });
    }
    const body = JSON.parse(raw) as { format?: unknown; workflow?: unknown; requestHash?: unknown };
    if (
      body?.format !== "synapsevm.cre-validation-request.v1" ||
      body.workflow !== "synapsevm-neuroproof-v1" ||
      typeof body.requestHash !== "string" ||
      !HASH.test(body.requestHash)
    ) {
      return NextResponse.json({ error: "A valid NeuroProof CRE request is required." }, { status: 400 });
    }

    const result = await runCreVerification(body);
    return NextResponse.json(result, {
      status: "accepted" in result && result.accepted ? 202 : 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "CRE verification could not complete.",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
