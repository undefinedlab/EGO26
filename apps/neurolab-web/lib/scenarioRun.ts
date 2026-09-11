/**
 * Running code you typed.
 *
 * The generated listing is only worth showing if you can change it, so the
 * editor buffer is executed for real rather than being a picture of an API.
 *
 * Two decisions worth stating:
 *
 * `import` lines are stripped and the same names are injected as arguments.
 * `new Function` cannot parse module syntax, and rewriting your code into
 * something else would make the listing a lie. The imports stay visible
 * because that is what you would write in a real file; here the bindings are
 * already in scope.
 *
 * `advanceRoad` is wrapped so that advancing the world also paints it. Any
 * loop that drives the road therefore drives the scene, with no extra call to
 * learn — and the wrapper is where the run deadline is checked.
 *
 * This executes on the page, with the page's privileges. It is your own code
 * in your own browser, which is the same bargain as any scratchpad, but a
 * `while (true) {}` that never calls into the harness will still lock the tab:
 * there is no pre-emption to be had on the main thread.
 */

import { canonical, type ComposePackage } from "./composeCompiler";
import {
  loadCompiledStack as realLoad,
  type CompiledStack,
  type Inputs,
  type ReplayBundle,
} from "./composeRuntime";
import { roadInputs, startRoad } from "./brakeDemo";
import { actorById, gapMetres, type Actor, type ActorState } from "./actors";
import { condition, saturate } from "./scenarios";

export type RunHooks = {
  print: (text: string) => void;
  show: (road: ActorState) => void;
  onReceipt: (replay: ReplayBundle) => void;
  /** Wall-clock budget for the whole run. */
  budgetMs: number;
  /** Bumped when the user resets; a stale run stops touching the UI. */
  cancelled: () => boolean;
};

const format = (v: unknown): string => {
  if (typeof v === "string") return v;
  if (v instanceof Error) return v.message;
  if (typeof v === "object" && v !== null) {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
};

/** Module syntax cannot be parsed by `new Function`; the names are injected instead. */
export const stripImports = (source: string) => source.replace(/^[ \t]*import\s[^;]*;[ \t]*\r?\n?/gm, "");

export class RunStopped extends Error {}

export async function runUserCode(source: string, pkg: ComposePackage, actor: Actor, hooks: RunHooks) {
  const deadline = Date.now() + hooks.budgetMs;
  let painted = 0;

  const checkBudget = () => {
    if (hooks.cancelled()) throw new RunStopped("Run cancelled.");
    if (Date.now() > deadline) {
      throw new RunStopped(
        `Run exceeded its ${Math.round(hooks.budgetMs / 1000)} s budget and was stopped. Check the loop's exit condition.`,
      );
    }
  };

  /** Advancing the world also paints it, throttled so the scene does not
   *  re-render once per simulated millisecond. */
  const advance = (road: ActorState, actions: Inputs): ActorState => {
    checkBudget();
    const next = actor.advance(road, actions);
    const now = Date.now();
    if (now - painted > 55) {
      painted = now;
      hooks.show(next);
    }
    return next;
  };

  /* Spreading a class instance would copy its fields and drop its methods, so
     the guard delegates explicitly. `step` is where the budget is enforced and
     where a receipt is noticed. */
  const guard = (stack: CompiledStack) =>
    ({
      step: async (inputs: Inputs) => {
        checkBudget();
        const result = await stack.step(inputs);
        if (result.replay) hooks.onReceipt(result.replay);
        return result;
      },
      reset: () => stack.reset(),
    }) as unknown as CompiledStack;

  const loadCompiledStack = async (input: ComposePackage | string = pkg) => guard(await realLoad(input));

  const consoleShim = {
    log: (...args: unknown[]) => hooks.print(args.map(format).join(" ")),
    info: (...args: unknown[]) => hooks.print(args.map(format).join(" ")),
    warn: (...args: unknown[]) => hooks.print(args.map(format).join(" ")),
    error: (...args: unknown[]) => hooks.print(args.map(format).join(" ")),
  };

  const bindings: Record<string, unknown> = {
    pkg,
    loadCompiledStack,
    startRoad,
    roadInputs,
    advance,
    advanceRoad: advance,
    actor,
    actorById,
    gapMetres,
    saturate,
    condition,
    canonical,
    console: consoleShim,
    show: (road: ActorState) => {
      checkBudget();
      hooks.show(road);
    },
    sleep: (ms: number) => new Promise((r) => setTimeout(r, Math.min(2000, Math.max(0, ms)))),
  };

  const names = Object.keys(bindings);
  const body = stripImports(source);

  let make: (...args: unknown[]) => Promise<unknown>;
  try {
    make = new Function(
      ...names,
      `return (async () => {\n${body}\n})();`,
    ) as (...args: unknown[]) => Promise<unknown>;
  } catch (e) {
    throw new Error(`Could not parse your code — ${e instanceof Error ? e.message : String(e)}`);
  }

  await make(...names.map((n) => bindings[n]));
}

/** The names available without importing them, for the editor's footnote. */
export const INJECTED = [
  "pkg",
  "loadCompiledStack",
  "startRoad",
  "roadInputs",
  "advance",
  "gapMetres",
  "saturate",
  "condition",
  "show",
  "sleep",
  "console",
];
