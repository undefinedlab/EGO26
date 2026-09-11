/**
 * The listing shown beside the run.
 *
 * Generated from the same package and body the runner uses, so what is on
 * screen is the code that produced the output and the scene next to it. The
 * import paths are the real ones in this repo — there is no published npm
 * package yet, and writing one here would advertise something that does not
 * exist.
 *
 * The NeuroBlock is called out deliberately. It does not appear as an import
 * of its own because it does not arrive that way: it travels inside the
 * package as locked bytes with a pinned digest, and the two moments that
 * matter — when it is instantiated and when it runs — are marked in place.
 */

import type { ComposePackage } from "./composeCompiler";
import type { Actor } from "./actors";

export function scenarioCode(pkg: ComposePackage, actor: Actor, speed: number, file: string, gain = 100) {
  const locks = Object.entries(pkg.lockfile);
  const blockLines = locks.length
    ? locks
        .map(([key, lock]) => `//   ${key}@${lock.version}  ${lock.digest.slice(0, 20)}…${lock.digest.slice(-6)}`)
        .join("\n")
    : "//   none — this Stack is entirely deterministic nodes";
  const names = locks.map(([key]) => key).join(", ") || "no block";

  return `import { loadCompiledStack } from "@/lib/composeRuntime";
import { actorById } from "@/lib/actors";
import { condition, saturate } from "@/lib/scenarios";

// ── The NeuroBlock rides inside the package ─────────────────────────────
// It is not a separate import. The package carries its locked model bytes
// and a pinned digest, both checked on load:
${blockLines}
import pkg from "./${file}" with { type: "json" };

// Instantiating the package is what loads and verifies those bytes.
const stack = await loadCompiledStack(pkg);   // ← ${names} instantiated here

// ── The body it is driving ──────────────────────────────────────────────
// ${actor.name} — ${actor.blurb} Commands leave through ${actor.actuator}.
const body = actorById("${actor.id}");
let road = body.start(${speed});

// Closed loop: what the Stack returns is what decelerates the body.
while (road.speedMmps > 0 && !road.collision) {
  // Channels clip at full scale; the runtime rejects out-of-range Q16.
  // Pre-gain in front of the block: the trigger is locked in the model, so
  // showing it a stronger signal is how it is made to commit sooner.
  const sensed = saturate(condition(body.sense(pkg, road), ${(gain / 100).toFixed(2)}));

  // ← ${names} runs here, once per scheduled tick, inside stack.step
  const { actions, events, replay } = await stack.step(sensed);

  road = body.advance(road, actions);
  if (replay) console.log("receipt", replay.receipt.hash);
}

console.log(road.collision ? "reached it" : "stopped short");`;
}

/* ── the smallest highlighter that reads well ──────────────────────────── */

export type Token = { text: string; kind: "plain" | "comment" | "string" | "keyword" | "number" | "block" };

const KEYWORDS = new Set([
  "import", "from", "with", "type", "const", "let", "function", "return", "for", "while", "if", "await",
  "new", "of", "in", "true", "false", "null", "undefined",
]);

/**
 * `blocks` are the module names in the package's lockfile. They are coloured
 * apart from everything else so the imported NeuroBlock is visible at a
 * glance, in comments as well as in code.
 */
export function highlight(line: string, blocks: string[] = []): Token[] {
  const mark = (tokens: Token[]): Token[] => {
    if (!blocks.length) return tokens;
    const out: Token[] = [];
    for (const t of tokens) {
      let rest = t.text;
      let hit = true;
      while (rest && hit) {
        hit = false;
        for (const b of blocks) {
          const i = rest.toLowerCase().indexOf(b.toLowerCase());
          if (i < 0) continue;
          if (i > 0) out.push({ text: rest.slice(0, i), kind: t.kind });
          out.push({ text: rest.slice(i, i + b.length), kind: "block" });
          rest = rest.slice(i + b.length);
          hit = true;
          break;
        }
      }
      if (rest) out.push({ text: rest, kind: t.kind });
    }
    return out;
  };

  if (line.trimStart().startsWith("//")) return mark([{ text: line, kind: "comment" }]);

  const out: Token[] = [];
  const re = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g;
  let last = 0;
  let m: RegExpExecArray | null;

  const pushPlain = (chunk: string) => {
    for (const piece of chunk.split(/(\b[A-Za-z_$][\w$]*\b|\b\d+(?:\.\d+)?\b)/g)) {
      if (!piece) continue;
      if (KEYWORDS.has(piece)) out.push({ text: piece, kind: "keyword" });
      else if (/^\d/.test(piece)) out.push({ text: piece, kind: "number" });
      else out.push({ text: piece, kind: "plain" });
    }
  };

  while ((m = re.exec(line))) {
    pushPlain(line.slice(last, m.index));
    out.push({ text: m[0], kind: "string" });
    last = m.index + m[0].length;
  }
  pushPlain(line.slice(last));
  return mark(out);
}
