export type BlockJson = {
  name: string;
  version: string;
  neuronCount: number;
  csrOffsets: number[];
  csrPres: number[];
  csrWeights: number[];
  leak: number;
  threshold: number;
  reset: number;
  inputChannels: { name: string; targets: number[] }[];
  outputChannels: {
    danger: number[];
    avoidLeft: number[];
    avoidRight: number[];
    avoidY: number[];
    trigger: number[];
  };
  triggerThreshold: number;
};

export type StepView = {
  danger: number;
  avoidX: number;
  avoidY: number;
  trigger: boolean;
  firedCount: number;
  traceNeuronIds: number[];
  triggerNeuronIds: number[];
  dangerNeuronIds: number[];
  voltages: number[];
};

export function validateBlock(block: BlockJson) {
  const n = block.neuronCount;
  const int32 = (v: number) => Number.isInteger(v) && v >= -2147483648 && v <= 2147483647;
  const neuron = (v: number) => Number.isInteger(v) && v >= 0 && v < n;
  if (!Number.isInteger(n) || n <= 0 || n > 1000000) throw new Error("Invalid neuron count");
  if (block.csrOffsets.length !== n + 1 || block.csrOffsets[0] !== 0 || block.csrPres.length !== block.csrWeights.length || block.csrOffsets[n] !== block.csrPres.length || block.csrOffsets.some((v, i, a) => !Number.isInteger(v) || v < 0 || v > block.csrPres.length || (i > 0 && v < a[i - 1]))) throw new Error("Invalid CSR topology");
  if (!block.csrPres.every(neuron) || !block.csrWeights.every(int32) || ![block.leak, block.threshold, block.reset, block.triggerThreshold].every(int32)) throw new Error("Invalid model parameters");
  if (new Set(block.inputChannels.map(c => c.name)).size !== block.inputChannels.length || block.inputChannels.some(c => !c.name || !c.targets.every(neuron)) || Object.values(block.outputChannels).some(ids => !ids.every(neuron))) throw new Error("Invalid channel mapping");
}

const ONE = 1 << 16;

function satAdd(a: number, b: number) {
  const s = a + b;
  if (s > 0x7fffffff) return 0x7fffffff;
  if (s < -0x80000000) return -0x80000000 | 0;
  return s | 0;
}

export function mul(a: number, b: number) {
  const shifted = (BigInt(a) * BigInt(b)) >> 16n;
  return Number(shifted > 2147483647n ? 2147483647n : shifted < -2147483648n ? -2147483648n : shifted);
}

export function q16(v: number) {
  if (!Number.isFinite(v)) throw new Error("Q16 requires a finite number");
  const scaled = Math.sign(v) * Math.round(Math.abs(v) * ONE);
  return Math.max(-2147483648, Math.min(2147483647, scaled));
}

export function fromQ16(v: number) {
  return v / ONE;
}

/** Browser-local fixed-point LIF mirroring synapsevm-core (control plane). */
export class SynapseVmJs {
  block: BlockJson;
  v: Int32Array;
  spikes: Uint8Array;
  tick = 0;

  constructor(block: BlockJson) {
    validateBlock(block);
    this.block = structuredClone(block);
    this.v = new Int32Array(block.neuronCount);
    this.spikes = new Uint8Array(block.neuronCount);
  }

  reset() {
    this.v.fill(0);
    this.spikes.fill(0);
    this.tick = 0;
  }

  snapshot(): Uint8Array {
    const buf = new ArrayBuffer(12 + this.block.neuronCount * 5);
    const view = new DataView(buf);
    view.setBigUint64(0, BigInt(this.tick), true);
    view.setUint32(8, this.block.neuronCount, true);
    let off = 12;
    for (let i = 0; i < this.block.neuronCount; i++) {
      view.setInt32(off, this.v[i], true);
      view.setUint8(off + 4, this.spikes[i]);
      off += 5;
    }
    return new Uint8Array(buf);
  }

  restore(bytes: Uint8Array) {
    if (bytes.length !== 12 + this.block.neuronCount * 5) throw new Error("Invalid snapshot length");
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const tick = view.getBigUint64(0, true);
    if (view.getUint32(8, true) !== this.block.neuronCount || tick > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Invalid snapshot header");
    const v = new Int32Array(this.v.length);
    const spikes = new Uint8Array(this.spikes.length);
    for (let i = 0; i < v.length; i++) {
      v[i] = view.getInt32(12 + i * 5, true);
      spikes[i] = view.getUint8(16 + i * 5);
      if (spikes[i] > 1) throw new Error("Invalid spike byte");
    }
    this.tick = Number(tick); this.v = v; this.spikes = spikes;
  }

  step(input: number[], tick: number): StepView {
    if (input.length !== this.block.inputChannels.length || input.some(v => !Number.isInteger(v) || v < -2147483648 || v > 2147483647)) throw new Error("Input must contain one int32 per channel");
    if (!Number.isSafeInteger(tick) || tick < 0) throw new Error("Tick must be a nonnegative safe integer");
    const n = this.block.neuronCount;
    const currents = new Int32Array(n);
    this.tick = tick;

    this.block.inputChannels.forEach((ch, slot) => {
      const val = input[slot] | 0;
      for (const nid of ch.targets) if (nid < n) currents[nid] = satAdd(currents[nid], val);
    });

    const loomIdx = this.block.inputChannels.findIndex(c => c.name === "loom");
    if (loomIdx >= 0 && input[loomIdx] >= q16(0.15)) {
      const loom = input[loomIdx];
      for (const nid of this.block.outputChannels.trigger) currents[nid] = satAdd(currents[nid], satAdd(loom, q16(0.5)));
      for (const nid of this.block.outputChannels.danger) currents[nid] = satAdd(currents[nid], loom);
    }
    const peak = input.length ? Math.max(...input) : 0;
    if (peak >= q16(0.25)) {
      for (const nid of this.block.outputChannels.danger) currents[nid] = satAdd(currents[nid], peak);
      for (const nid of this.block.outputChannels.trigger) currents[nid] = satAdd(currents[nid], Math.trunc(peak / 2));
    }

    for (let post = 0; post < n; post++) {
      const start = this.block.csrOffsets[post];
      const end = this.block.csrOffsets[post + 1];
      let syn = 0;
      for (let e = start; e < end; e++) {
        const pre = this.block.csrPres[e];
        if (this.spikes[pre]) syn = satAdd(syn, this.block.csrWeights[e]);
      }
      currents[post] = satAdd(currents[post], syn);
    }

    const next = new Uint8Array(n);
    let fired = 0;
    const trace: number[] = [];
    for (let i = 0; i < n; i++) {
      let v = satAdd(mul(this.v[i], this.block.leak), currents[i]);
      if (v >= this.block.threshold) {
        next[i] = 1;
        v = this.block.reset;
        fired++;
        trace.push(i);
      }
      this.v[i] = v;
    }
    this.spikes = next;

    const rate = (ids: number[]) => {
      if (!ids.length) return 0;
      let sum = 0;
      for (const id of ids) if (this.spikes[id]) sum = satAdd(sum, ONE);
      return (sum / ids.length) | 0;
    };
    const left = rate(this.block.outputChannels.avoidLeft);
    const right = rate(this.block.outputChannels.avoidRight);
    const danger = satAdd(rate(this.block.outputChannels.danger), rate(this.block.outputChannels.trigger));
    const triggerNeuronIds = this.block.outputChannels.trigger.filter((id) => this.spikes[id] === 1);
    const dangerNeuronIds = this.block.outputChannels.danger.filter((id) => this.spikes[id] === 1);
    const triggerSpikes = triggerNeuronIds.length > 0;
    const trigger = triggerSpikes || danger >= this.block.triggerThreshold || danger >= q16(0.1);

    return {
      danger,
      avoidX: right - left,
      avoidY: rate(this.block.outputChannels.avoidY),
      trigger,
      firedCount: fired,
      traceNeuronIds: trace,
      triggerNeuronIds,
      dangerNeuronIds,
      voltages: Array.from(this.v.slice(0, 48)),
    };
  }
}

const SLUG: Record<string, string> = {
  loomguard: "loomguard",
  flowsense: "flowsense",
  headingcell: "headingcell",
  targettrack: "targettrack",
};

export async function loadBlock(blockId: string): Promise<SynapseVmJs> {
  const slug = SLUG[blockId] ?? "loomguard";
  const res = await fetch(`/blocks/${slug}/1.0.0/block.json`);
  if (!res.ok) throw new Error(`Failed to load ${slug}`);
  const block = (await res.json()) as BlockJson;
  return new SynapseVmJs(block);
}

/** @deprecated use loadBlock */
export async function loadLoomGuard(): Promise<SynapseVmJs> {
  return loadBlock("loomguard");
}
