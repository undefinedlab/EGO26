import { NextRequest, NextResponse } from "next/server";
import { runCreSimulation } from "@/lib/creRunner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HASH = /^sha256:[a-f0-9]{64}$/;

export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (origin && new URL(origin).host !== host) {
      return NextResponse.json({ error: "Cross-origin CRE request rejected." }, { status: 403 });
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

    return NextResponse.json(await runCreSimulation(body), {
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
