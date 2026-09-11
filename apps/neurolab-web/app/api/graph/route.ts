import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import {
  emptyIndex,
  findValidation,
  upsertStack,
  upsertValidation,
  type AnchorInput,
  type GraphIndexSnapshot,
} from "@/lib/graphPartner";

export const runtime = "nodejs";

const FILE = path.join(process.cwd(), ".data", "graph-index.json");

async function load(): Promise<GraphIndexSnapshot> {
  try {
    const raw = await readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as GraphIndexSnapshot;
    if (parsed?.format === "synapsevm.graph-index.v1") return parsed;
  } catch {
    /* fresh index */
  }
  return emptyIndex();
}

async function save(snap: GraphIndexSnapshot) {
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(FILE, JSON.stringify(snap, null, 2), "utf8");
}

export async function GET() {
  const snap = await load();
  return NextResponse.json({
    format: snap.format,
    counts: {
      validations: snap.validations.length,
      stacks: snap.stacks.length,
      blocks: snap.blocks.length,
    },
    validations: snap.validations.slice(0, 50),
    stacks: snap.stacks.slice(0, 50),
  });
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON body required." }, { status: 400 });
  }

  const action = String(body.action ?? "");
  const snap = await load();

  if (action === "lookup") {
    const requestHash = String(body.requestHash ?? "");
    if (!requestHash) return NextResponse.json({ error: "requestHash required." }, { status: 400 });
    try {
      return NextResponse.json({ validation: findValidation(snap, requestHash) });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
    }
  }

  if (action === "anchor") {
    try {
      const input: AnchorInput = {
        requestHash: String(body.requestHash ?? ""),
        receiptRoot: String(body.receiptRoot ?? ""),
        blockRoot: String(body.blockRoot ?? ""),
        score: Number(body.score ?? 0),
        evidenceURI: body.evidenceURI != null ? String(body.evidenceURI) : undefined,
        validator: body.validator != null ? String(body.validator) : undefined,
        tag: body.tag != null ? String(body.tag) : null,
        txHash: body.txHash != null ? String(body.txHash) : undefined,
      };
      const next = upsertValidation(snap, input);
      await save(next);
      return NextResponse.json({ validation: findValidation(next, input.requestHash) });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
    }
  }

  if (action === "registerStack") {
    try {
      const next = upsertStack(snap, {
        stackRoot: String(body.stackRoot ?? ""),
        manifestURI: body.manifestURI != null ? String(body.manifestURI) : undefined,
        name: body.name != null ? String(body.name) : undefined,
        version: body.version != null ? String(body.version) : undefined,
        publisher: body.publisher != null ? String(body.publisher) : undefined,
      });
      await save(next);
      return NextResponse.json({ stack: next.stacks[0] });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
    }
  }

  if (action === "graphql") {
    // Tiny subset for demos: { validations(where:{requestHash}) { … } }
    const query = String(body.query ?? "");
    const match = /requestHash:\s*"([^"]+)"/.exec(query);
    if (match) {
      try {
        const validation = findValidation(snap, match[1]);
        return NextResponse.json({
          data: { validations: validation ? [validation] : [] },
        });
      } catch (e) {
        return NextResponse.json({ errors: [{ message: e instanceof Error ? e.message : String(e) }] }, { status: 400 });
      }
    }
    return NextResponse.json({
      data: {
        validations: snap.validations.slice(0, 25),
        neuroStacks: snap.stacks.slice(0, 25),
      },
    });
  }

  return NextResponse.json({ error: "Unknown action. Use lookup | anchor | registerStack | graphql." }, { status: 400 });
}
