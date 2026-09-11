import { NextResponse } from "next/server";
import {
  CAPABILITIES_REGISTRY,
  decodeGetDon,
  decodeGetNodes,
  encodeGetDon,
  encodeGetNodes,
} from "@/lib/creRegistry";

/**
 * DON signer sets, read from the Chainlink Capabilities Registry.
 *
 * This runs on the server for one reason: the RPC URL is a credential, and a
 * browser cannot hold one. The response carries only public chain data.
 *
 * Set SYNAPSEVM_ETH_RPC_URL to an Ethereum Mainnet endpoint. Without it the
 * route reports that it is unconfigured rather than pretending — a verifier
 * that silently falls back to a local list is worse than one that stops.
 *
 * Registry data changes only on DON reconfiguration, so answers are cached per
 * DON for the lifetime of the process, as Chainlink's own guide recommends.
 */

export const dynamic = "force-dynamic";

type Signers = { donId: number; f: number; quorum: number; signers: string[]; nodeCount: number };

const cache = new Map<number, Signers>();

function registryLookupError(error: unknown, donId: number): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/execution reverted/i.test(message)) {
    return `The Capability Registry does not expose DON ${donId}. Local CRE simulation reports use test signers and remain report-only until a deployed DON signer set is available.`;
  }
  return `Capability Registry lookup for DON ${donId} failed: ${message}`;
}

async function ethCall(rpc: string, to: string, data: string): Promise<string> {
  const res = await fetch(rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest"] }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw Error(`RPC responded ${res.status}.`);
  const body = (await res.json()) as { result?: string; error?: { message?: string } };
  if (body.error) throw Error(body.error.message ?? "RPC returned an error.");
  if (typeof body.result !== "string" || !body.result.startsWith("0x")) throw Error("RPC returned no result.");
  if (body.result === "0x") throw Error("The registry returned empty data — check the DON id and the network.");
  return body.result;
}

export async function GET(request: Request) {
  const rpc = process.env.SYNAPSEVM_ETH_RPC_URL;
  const donIdRaw = new URL(request.url).searchParams.get("donId");
  const donId = Number(donIdRaw);

  if (!Number.isInteger(donId) || donId < 0) {
    return NextResponse.json({ error: "A whole donId is required." }, { status: 400 });
  }
  if (!rpc) {
    return NextResponse.json(
      {
        configured: false,
        error:
          "SYNAPSEVM_ETH_RPC_URL is not set, so the Capabilities Registry cannot be read. DON signatures stay unverified until it is.",
        registry: CAPABILITIES_REGISTRY,
      },
      { status: 503 },
    );
  }

  const hit = cache.get(donId);
  if (hit) return NextResponse.json({ configured: true, cached: true, registry: CAPABILITIES_REGISTRY, ...hit });

  try {
    const { f, p2pIds } = decodeGetDon(await ethCall(rpc, CAPABILITIES_REGISTRY, encodeGetDon(donId)));
    if (!p2pIds.length) throw Error(`DON ${donId} has no nodes in the registry.`);

    const signers = decodeGetNodes(
      await ethCall(rpc, CAPABILITIES_REGISTRY, encodeGetNodes(p2pIds)),
      p2pIds.length,
    );

    const value: Signers = {
      donId,
      f,
      // OCR tolerates f faults, so f+1 honest signatures is the threshold.
      quorum: f + 1,
      signers: signers.map((s) => s.toLowerCase()),
      nodeCount: p2pIds.length,
    };
    cache.set(donId, value);
    return NextResponse.json({ configured: true, cached: false, registry: CAPABILITIES_REGISTRY, ...value });
  } catch (e) {
    return NextResponse.json(
      { configured: true, error: registryLookupError(e, donId), registry: CAPABILITIES_REGISTRY },
      { status: 502 },
    );
  }
}
