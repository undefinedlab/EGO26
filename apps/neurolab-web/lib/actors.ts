/**
 * Actors — the same situation, three bodies.
 *
 * There is one scenario worth showing: something is in the way. What changes
 * is the machine it is in the way of, and that is the point — a compiled Stack
 * is a module, so the same locked model brakes a van, holds off a drone and
 * stops a gantry arm mid-sweep.
 *
 * Physics is deliberately shared. Each body approaches an obstacle 24 units
 * away, the Stack sees proximity and looming, and whatever it returns —
 * BrakeCommand or ControlVector — is what decelerates it. Only the axis, the
 * units and the scene differ, so a difference in outcome between actors is a
 * difference in the body, never in the model.
 *
 * The arm is the exception worth knowing about: once it stops safely it
 * retracts along its rail, because a gantry that stops dead is not a gantry.
 * Nothing is sensed behind it, so the Stack stays quiet on the way back.
 */

import { DEFINITIONS, type ComposePackage } from "./composeCompiler";
import type { Inputs } from "./composeRuntime";
import { advanceRoad, roadInputs, startRoad, type RoadState } from "./brakeDemo";

export type ActorId = "car" | "drone" | "arm";

/** RoadState plus what a reversing body needs. Structurally a RoadState, so
 *  the existing road scene renders it unchanged. */
export type ActorState = RoadState & {
  /** +1 outbound toward the obstacle, -1 retracting. */
  direction: 1 | -1;
  retracting: boolean;
  /** Speed the body set out at. Braking leaves only a residue behind, which
   *  is the wrong speed to come home at. */
  cruiseMmps: number;
  /** Furthest the body ever got. A body that stops and then returns has its
   *  real result here — the final position would report where it parked, not
   *  how close it came. */
  reachedUm: number;
};

export const REACH_M = 24;
export const gapMetres = (s: ActorState) => Math.max(0, REACH_M - s.positionUm / 1_000_000);

/** The arm sweeps to the figure standing at 160 degrees. */
export const SWEEP_DEG = 160;
export const sweptDegrees = (s: ActorState) => (s.positionUm / 1_000_000 / REACH_M) * SWEEP_DEG;
export const gapDegrees = (s: ActorState) => Math.max(0, SWEEP_DEG - sweptDegrees(s));

export type Actor = {
  id: ActorId;
  name: string;
  /** One line. The panel is not the place for an essay. */
  blurb: string;
  expect: string;
  /** Node type this body drives. Shown so a mismatch is visible up front. */
  actuator: string;
  /** What separation means for this body, and what to call it. */
  gap: { of: (s: ActorState) => number; unit: string; label: string };
  /** Label and range for the one speed control. */
  speed: { label: string; unit: string; min: number; max: number; step: number; value: number };
  /** mm/s per unit of the speed control. */
  toMmps: (v: number) => number;
  fromMmps: (mmps: number) => number;
  start: (speed: number) => ActorState;
  advance: (s: ActorState, actions: Inputs) => ActorState;
  sense: (pkg: ComposePackage, s: ActorState) => Inputs;
  /** Source shown in the listing for this body's step. */
  source: string;
};

const base = (speedMmps: number): ActorState => ({
  ...startRoad(),
  speedMmps,
  obstacle: true,
  direction: 1,
  retracting: false,
  cruiseMmps: speedMmps,
  reachedUm: 0,
});

const reached = (s: ActorState): ActorState => ({ ...s, reachedUm: Math.max(s.reachedUm, s.positionUm) });

/** How close the body actually came, whatever it did afterwards. */
export const closestOf = (a: Actor, s: ActorState) => a.gap.of({ ...s, positionUm: s.reachedUm });

/** Nothing is in the way behind you. */
const senseAhead = (pkg: ComposePackage, s: ActorState) =>
  roadInputs(pkg, s.retracting ? { ...s, obstacle: false } : s);

const kph = (v: number) => Math.round((v * 1000) / 3.6);
const fromKph = (mmps: number) => +((mmps * 3.6) / 1000).toFixed(1);

export const ACTORS: Actor[] = [
  {
    id: "car",
    name: "Van",
    blurb: "Barrier in lane, 24 m ahead.",
    expect: "Looming rises as the gap closes; the reflex should brake and stop short.",
    actuator: "CarBrake",
    gap: { of: gapMetres, unit: "m", label: "Clearance" },
    speed: { label: "Approach speed", unit: " km/h", min: 5, max: 90, step: 1, value: 29 },
    toMmps: kph,
    fromMmps: fromKph,
    start: (v) => base(kph(v)),
    advance: (s, a) => reached({ ...s, ...advanceRoad(s, a) }),
    sense: senseAhead,
    source: `return roadInputs(pkg, road);`,
  },
  {
    id: "drone",
    name: "Drone",
    blurb: "Flying at a wall, 24 m ahead.",
    expect: "Same model, lighter body: it sheds speed faster and should stop with more to spare.",
    actuator: "DroneControl",
    gap: { of: gapMetres, unit: "m", label: "Clearance" },
    speed: { label: "Cruise speed", unit: " km/h", min: 5, max: 60, step: 1, value: 22 },
    toMmps: kph,
    fromMmps: fromKph,
    start: (v) => base(kph(v)),
    advance: (s, a) => reached({ ...s, ...advanceRoad(s, a) }),
    sense: senseAhead,
    source: `return roadInputs(pkg, road);`,
  },
  {
    id: "arm",
    name: "Robotic arm",
    blurb: "Slewing around its base toward a person standing at 160°.",
    expect: "Stops mid-slew and returns. Nothing is sensed behind it, so it stays quiet on the way back.",
    actuator: "RoverSteering",
    gap: { of: gapDegrees, unit: "°", label: "Arc to figure" },
    speed: { label: "Slew rate", unit: " °/s", min: 5, max: 120, step: 1, value: 45 },
    // The world measures a 24-unit approach; the arm renders it as 160 degrees.
    toMmps: (v) => Math.round((v * REACH_M * 1000) / SWEEP_DEG),
    fromMmps: (mmps) => Math.round((mmps * SWEEP_DEG) / (REACH_M * 1000)),
    start: (v) => base(Math.round((v * REACH_M * 1000) / SWEEP_DEG)),
    advance: (s, a) => {
      // Retracting is plain motion: the decision has already been taken.
      if (s.retracting) {
        const position = Math.max(0, s.positionUm - s.cruiseMmps);
        return { ...s, tick: s.tick + 1, positionUm: position, speedMmps: position === 0 ? 0 : s.cruiseMmps };
      }
      // advanceRoad rebuilds a bare RoadState, so the actor's own fields have
      // to be carried across or cruiseMmps is lost after the first tick.
      const next: ActorState = reached({ ...s, ...advanceRoad(s, a) });
      // Stopped short of the obstruction — reverse and come home.
      if (next.speedMmps === 0 && !next.collision) {
        return { ...next, direction: -1, retracting: true, speedMmps: s.cruiseMmps, brakeQ16: 0 };
      }
      return { ...next, direction: s.direction, retracting: false };
    },
    sense: senseAhead,
    source: `// Nothing is in the way on the way back.
return roadInputs(pkg, road.retracting ? { ...road, obstacle: false } : road);`,
  },
];

export const actorById = (id: string) => ACTORS.find((a) => a.id === id) ?? ACTORS[0];

/**
 * Does the loaded Stack have something this body can be driven by?
 *
 * Any ControlVector or BrakeCommand actuator will move any of these bodies —
 * the physics only reads the command — but saying which actuator the package
 * actually carries beats letting a mismatch look like an inert model.
 */
export function actorFit(pkg: ComposePackage, actor: Actor) {
  const types = pkg.graph.nodes.map((n) => n.type);
  const sensed = types.some((t) => t === "WorldState" || t === "EventCamera");
  const actuators = types.filter((t) => DEFINITIONS[t]?.family === "actuator");
  const exact = actuators.includes(actor.actuator);
  return {
    sensed,
    actuators,
    exact,
    ok: sensed && actuators.length > 0,
    note: !sensed
      ? "This Stack has no WorldState or EventCamera, so nothing can reach it."
      : !actuators.length
        ? "This Stack has no actuator, so its decisions cannot move anything."
        : exact
          ? ""
          : `Driven by ${actuators.join(", ")} rather than ${actor.actuator} — the command is read the same way, but this package was not built for this body.`,
  };
}
