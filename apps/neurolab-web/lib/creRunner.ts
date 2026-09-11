import { spawn } from "node:child_process";
import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const MAX_OUTPUT_BYTES = 2_000_000;
const RUN_TIMEOUT_MS = 60_000;
const ANSI = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;

export type CreSimulationRun = {
  format: "synapsevm.cre-run-response.v1";
  mode: "authenticated-local-simulation";
  workflow: "synapsevm-neuroproof-v1";
  durationMs: number;
  result: unknown;
};

function cleanOutput(value: string) {
  return value.replace(ANSI, "").replace(/\r/g, "");
}

export function extractCreSimulationResult(output: string): unknown {
  const lines = cleanOutput(output).split("\n");
  const marker = lines.findIndex((line) => line.includes("Workflow Simulation Result:"));
  if (marker < 0) throw Error("CRE completed without returning a workflow result.");
  const encoded = lines.slice(marker + 1).find((line) => line.trim().startsWith('"{'))?.trim();
  if (!encoded) throw Error("CRE returned an unreadable workflow result.");
  const json = JSON.parse(encoded) as unknown;
  if (typeof json !== "string") throw Error("CRE returned an unexpected workflow result wrapper.");
  return JSON.parse(json) as unknown;
}

async function exists(file: string) {
  try {
    await access(file, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function resolveCreProject() {
  const configured = process.env.SYNAPSEVM_CRE_PROJECT_DIR;
  const candidates = [
    configured,
    path.resolve(process.cwd(), "cre"),
    path.resolve(process.cwd(), "..", "..", "cre"),
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    if (
      (await exists(path.join(candidate, "project.yaml"))) &&
      (await exists(path.join(candidate, "neuroproof-workflow", "binary.wasm")))
    ) {
      return candidate;
    }
  }
  throw Error("The CRE project or compiled neuroproof binary is unavailable. Build the workflow first.");
}

function resolveCreExecutable() {
  if (process.env.SYNAPSEVM_CRE_CLI) return process.env.SYNAPSEVM_CRE_CLI;
  if (process.platform === "win32" && process.env.LOCALAPPDATA) {
    return path.join(process.env.LOCALAPPDATA, "Programs", "cre", "cre.exe");
  }
  return "cre";
}

async function spawnCre(executable: string, args: string[], cwd: string) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd,
      windowsHide: true,
      shell: false,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      child.kill();
      settled = true;
      reject(Error("CRE simulation exceeded 60 seconds."));
    }, RUN_TIMEOUT_MS);
    const collect = (chunk: Buffer) => {
      output += chunk.toString("utf8");
      if (Buffer.byteLength(output, "utf8") > MAX_OUTPUT_BYTES && !settled) {
        child.kill();
        settled = true;
        clearTimeout(timer);
        reject(Error("CRE simulation output exceeded 2 MB."));
      }
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        const clean = cleanOutput(output);
        const reason = clean.split("\n").filter(Boolean).slice(-4).join(" ");
        reject(Error(reason || `CRE simulation exited with code ${code}.`));
        return;
      }
      resolve(output);
    });
  });
}

export async function runCreSimulation(request: unknown): Promise<CreSimulationRun> {
  const project = await resolveCreProject();
  const executable = resolveCreExecutable();
  if (!(await exists(executable)) && path.isAbsolute(executable)) {
    throw Error("The Chainlink CRE CLI is not installed at the configured path.");
  }

  const scratch = await mkdtemp(path.join(tmpdir(), "synapsevm-cre-"));
  const requestPath = path.join(scratch, "request.json");
  const started = Date.now();
  try {
    await writeFile(requestPath, JSON.stringify(request), "utf8");
    const output = await spawnCre(
      executable,
      [
        "workflow",
        "simulate",
        "./neuroproof-workflow",
        "--target",
        "staging-settings",
        "--non-interactive",
        "--trigger-index",
        "0",
        "--http-payload",
        requestPath,
        "--wasm",
        "binary.wasm",
      ],
      project,
    );
    return {
      format: "synapsevm.cre-run-response.v1",
      mode: "authenticated-local-simulation",
      workflow: "synapsevm-neuroproof-v1",
      durationMs: Date.now() - started,
      result: extractCreSimulationResult(output),
    };
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}
