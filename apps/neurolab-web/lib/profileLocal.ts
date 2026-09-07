/** Browser-local profile + collections. No account / auth yet. */

export const PROFILE_KEY = "synapsevm.profile.v1";
export const SAVED_KEY = "synapsevm.library.saved";
export const WORKBENCH_KEY = "synapsevm.workbench.v1";

export type LocalProfile = {
  displayName: string;
  handle: string;
  updatedAt: string | null;
};

export type WorkbenchSummary = {
  name: string;
  version: string;
  nodeCount: number;
  edgeCount: number;
  nodes: string[];
} | null;

export const DEFAULT_PROFILE: LocalProfile = {
  displayName: "Local builder",
  handle: "local",
  updatedAt: null,
};

export function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function readProfile(): LocalProfile {
  const raw = readJson<Partial<LocalProfile> | null>(PROFILE_KEY, null);
  if (!raw || typeof raw !== "object") return { ...DEFAULT_PROFILE };
  return {
    displayName:
      typeof raw.displayName === "string" && raw.displayName.trim()
        ? raw.displayName.trim().slice(0, 48)
        : DEFAULT_PROFILE.displayName,
    handle:
      typeof raw.handle === "string" && raw.handle.trim()
        ? raw.handle
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, "")
            .slice(0, 32) || DEFAULT_PROFILE.handle
        : DEFAULT_PROFILE.handle,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
  };
}

export function writeProfile(next: Pick<LocalProfile, "displayName" | "handle">): LocalProfile {
  const profile: LocalProfile = {
    displayName: next.displayName.trim().slice(0, 48) || DEFAULT_PROFILE.displayName,
    handle:
      next.handle
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "")
        .slice(0, 32) || DEFAULT_PROFILE.handle,
    updatedAt: new Date().toISOString(),
  };
  writeJson(PROFILE_KEY, profile);
  return profile;
}

export function readSavedIds(): string[] {
  const data = readJson<unknown>(SAVED_KEY, []);
  if (!Array.isArray(data)) return [];
  return data.filter((x): x is string => typeof x === "string");
}

export function writeSavedIds(ids: string[]) {
  writeJson(SAVED_KEY, [...new Set(ids)]);
}

export function readWorkbenchSummary(): WorkbenchSummary {
  const g = readJson<{
    name?: string;
    version?: string;
    nodes?: { id?: string; type?: string }[];
    edges?: unknown[];
  } | null>(WORKBENCH_KEY, null);
  if (!g || typeof g !== "object") return null;
  const nodes = Array.isArray(g.nodes)
    ? g.nodes.map((n) => (typeof n?.id === "string" ? n.id : typeof n?.type === "string" ? n.type : "")).filter(Boolean)
    : [];
  return {
    name: typeof g.name === "string" ? g.name : "Untitled stack",
    version: typeof g.version === "string" ? g.version : "0.0.0",
    nodeCount: nodes.length,
    edgeCount: Array.isArray(g.edges) ? g.edges.length : 0,
    nodes,
  };
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "LB";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
