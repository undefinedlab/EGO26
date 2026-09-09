/**
 * The conversation: free text in, an updated BuildSpec out.
 *
 * Extraction is the only part a language model is better at than code, so it
 * is the only part that is swappable. Everything downstream — the wiring, the
 * validation, the compile — stays deterministic, which is what stops a model
 * from inventing an illegal graph.
 *
 * With no model configured this falls back to vocabulary matching. That is a
 * real limitation and the UI says so rather than pretending otherwise.
 */

import { plan, describe, type Plan } from "./planner";
import {
  CAPABILITY_LABELS,
  PLATFORM_LABELS,
  emptySpec,
  isBuildable,
  missing,
  type BuildSpec,
  type Capability,
  type Platform,
  type Sensor,
} from "./spec";

export type Turn = {
  role: "user" | "assistant";
  text: string;
  /** Options the user can pick instead of typing. */
  choices?: { label: string; value: string }[];
  /** Attached when the assistant has something buildable. */
  plan?: Plan;
};

export type Extraction = {
  platform?: Platform;
  sensors?: Sensor[];
  capabilities?: Capability[];
  name?: string;
  deadlineMs?: number;
};

/* ------------------------------------------------------------------ *
 * Local extraction — vocabulary, not comprehension
 * ------------------------------------------------------------------ */

const PLATFORM_WORDS: [RegExp, Platform][] = [
  [/\b(drone|uav|quad|copter|multirotor|aerial)\b/, "drone"],
  [/\b(rover|ground robot|mobile robot|agv|amr|wheeled)\b/, "ground-robot"],
  [/\b(arm|manipulator|gripper|end effector)\b/, "arm"],
  [/\b(car|vehicle|truck|forklift|automotive|van|lorry)\b/, "vehicle"],
  [/\b(gantry|cnc|mill|pick and place|linear stage)\b/, "gantry"],
  [/\b(cctv|fixed cam|inspection cam|security cam)\b/, "camera"],
  [/\b(robot|bot|machine)\b/, "ground-robot"],
];

const CAPABILITY_WORDS: [RegExp, Capability][] = [
  [/\b(collision|obstacle|crash|bump|bumping|avoid|hit|hitting|colliding|looming|loom|safety|e-?stop|stop before|run into)\b/, "collision-avoidance"],
  [/\b(brake|braking|brakes)\b/, "emergency-brake"],
  [/\b(nominal|normal steering|override|keep steering|manual|teleop|joystick|autopilot)\b/, "nominal-steering"],
  [/\b(clamp|limit|cap|gentle|smooth|too sharp|steering limit)\b/, "steering-limit"],
  // Declared interfaces the bundled model does not implement. Matched so the
  // planner can refuse them out loud instead of silently ignoring the request.
  [/\b(heading|course|straight|navigate|navigation|steer to|waypoint|yaw)\b/, "course-holding"],
  [/\b(drift|gust|wind|stabili[sz]e|stabili[sz]ation|hover|vibration)\b/, "drift-correction"],
  [/\b(follow|track|tracking|target|pursue|chase|beacon)\b/, "target-following"],
];

const SENSOR_WORDS: [RegExp, Sensor][] = [
  [/\b(camera|vision|visual|optical|event camera|sees|image)\b/, "camera"],
  [/\b(simulator|simulation|sim|bench|recorded|replay|worldstate|test rig)\b/, "simulator"],
  [/\b(imu|gyro|gyroscope|accelerometer|inertial)\b/, "imu"],
];

function matchAll<T>(text: string, table: [RegExp, T][]): T[] {
  const hits: T[] = [];
  for (const [re, value] of table) {
    if (re.test(text) && !hits.includes(value)) hits.push(value);
  }
  return hits;
}

export function extractLocal(text: string): Extraction {
  const t = text.toLowerCase();
  const out: Extraction = {};

  const platforms = matchAll(t, PLATFORM_WORDS);
  if (platforms.length) out.platform = platforms[0];

  const caps = matchAll(t, CAPABILITY_WORDS);
  if (caps.length) out.capabilities = caps;

  const sensors = matchAll(t, SENSOR_WORDS);
  if (sensors.length) out.sensors = sensors;

  const deadline = t.match(/(\d+(?:\.\d+)?)\s*ms\b/);
  if (deadline) {
    const ms = Number(deadline[1]);
    if (Number.isFinite(ms) && ms > 0 && ms <= 1000) out.deadlineMs = ms;
  }

  return out;
}

/* ------------------------------------------------------------------ */

export function mergeSpec(spec: BuildSpec, e: Extraction, note?: string): BuildSpec {
  return {
    ...spec,
    // Platform is established once. Later turns talk about sensors — "it has a
    // camera" must not silently reclassify a robot as a fixed camera.
    platform: spec.platform === "unknown" ? (e.platform ?? spec.platform) : spec.platform,
    sensors: e.sensors ? [...new Set([...spec.sensors, ...e.sensors])] : spec.sensors,
    capabilities: e.capabilities ? [...new Set([...spec.capabilities, ...e.capabilities])] : spec.capabilities,
    deadlineMs: e.deadlineMs ?? spec.deadlineMs,
    name: e.name ?? spec.name,
    notes: note ? [...spec.notes, note] : spec.notes,
  };
}

const capabilityChoices = () =>
  (Object.keys(CAPABILITY_LABELS) as Capability[]).map((c) => ({
    label: CAPABILITY_LABELS[c],
    value: c,
  }));

const platformChoices = () =>
  (Object.keys(PLATFORM_LABELS) as Platform[])
    .filter((p) => p !== "unknown")
    .map((p) => ({ label: PLATFORM_LABELS[p], value: p }));

/**
 * Produce the assistant's next turn. `extract` is injected so the API route
 * can supply a model-backed extractor when one is configured.
 */
export function respond(
  spec: BuildSpec,
  userText: string,
  extract: (text: string) => Extraction = extractLocal,
): { spec: BuildSpec; turn: Turn } {
  const next = mergeSpec(spec, extract(userText), userText.trim());

  // Opening move: no capability yet, so offer the catalogue rather than
  // interrogating someone who has not said what they want.
  if (!next.capabilities.length) {
    return {
      spec: next,
      turn: {
        role: "assistant",
        text:
          next.platform === "unknown"
            ? "Tell me what it should do and I will wire it. These are the four things this library can add to a machine:"
            : `A ${PLATFORM_LABELS[next.platform].toLowerCase()} — good. Which of these do you want to add?`,
        choices: capabilityChoices(),
      },
    };
  }

  const gaps = missing(next);
  if (gaps.length) {
    const gap = gaps[0];
    return {
      spec: next,
      turn: {
        role: "assistant",
        text: gap.question,
        choices:
          gap.field === "platform"
            ? platformChoices()
            : gap.field === "sensors"
              ? [
                  { label: "Event camera on the machine", value: "event camera" },
                  { label: "Recorded simulator features", value: "simulator" },
                ]
              : capabilityChoices(),
      },
    };
  }

  const built = plan(next);
  const caps = next.capabilities.map((c) => CAPABILITY_LABELS[c].toLowerCase()).join(", ");

  return {
    spec: next,
    turn: {
      role: "assistant",
      text: `For a ${PLATFORM_LABELS[next.platform].toLowerCase()} that should ${caps}: ${describe(built)}`,
      plan: built,
    },
  };
}

export const startSpec = emptySpec;
export { isBuildable };
