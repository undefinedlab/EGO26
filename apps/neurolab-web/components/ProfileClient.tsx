"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  KIND_LABELS,
  formatBytes,
  repoHref,
  type ArtifactKind,
  type LibraryItem,
} from "@/lib/library";
import {
  DEFAULT_PROFILE,
  initials,
  readProfile,
  readSavedIds,
  readWorkbenchSummary,
  writeProfile,
  writeSavedIds,
  type LocalProfile,
  type WorkbenchSummary,
} from "@/lib/profileLocal";

const GROUP_ORDER: ArtifactKind[] = [
  "NeuroBlock",
  "NeuroStack",
  "Dataset",
  "Circuit",
  "Region",
  "Brain",
  "Motif",
];

export function ProfileClient({ items }: { items: LibraryItem[] }) {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<LocalProfile>(DEFAULT_PROFILE);
  const [draftName, setDraftName] = useState(DEFAULT_PROFILE.displayName);
  const [draftHandle, setDraftHandle] = useState(DEFAULT_PROFILE.handle);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [workbench, setWorkbench] = useState<WorkbenchSummary>(null);
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState(false);

  const reload = () => {
    const p = readProfile();
    setProfile(p);
    setDraftName(p.displayName);
    setDraftHandle(p.handle);
    setSavedIds(readSavedIds());
    setWorkbench(readWorkbenchSummary());
  };

  useEffect(() => {
    reload();
    setReady(true);
    const onFocus = () => reload();
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onFocus);
    };
  }, []);

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const savedItems = useMemo(
    () => savedIds.map((id) => byId.get(id)).filter((x): x is LibraryItem => Boolean(x)),
    [savedIds, byId]
  );
  const missingSaved = savedIds.filter((id) => !byId.has(id));
  const localPubs = useMemo(
    () => items.filter((i) => i.origin === "local").sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "")),
    [items]
  );

  const grouped = useMemo(() => {
    const map = new Map<ArtifactKind, LibraryItem[]>();
    for (const item of savedItems) {
      const list = map.get(item.kind) ?? [];
      list.push(item);
      map.set(item.kind, list);
    }
    return GROUP_ORDER.filter((k) => map.has(k)).map((k) => ({ kind: k, items: map.get(k)! }));
  }, [savedItems]);

  const saveIdentity = () => {
    try {
      const next = writeProfile({ displayName: draftName, handle: draftHandle });
      setProfile(next);
      setDraftName(next.displayName);
      setDraftHandle(next.handle);
      setEditing(false);
      setNotice("Profile saved on this device.");
    } catch {
      setNotice("Could not write to local storage.");
    }
  };

  const unsave = (id: string) => {
    const next = savedIds.filter((x) => x !== id);
    try {
      writeSavedIds(next);
      setSavedIds(next);
    } catch {
      setNotice("Could not update saved collection.");
    }
  };

  const clearSaved = () => {
    try {
      writeSavedIds([]);
      setSavedIds([]);
      setNotice("Cleared saved collection on this device.");
    } catch {
      setNotice("Could not clear collection.");
    }
  };

  if (!ready) {
    return (
      <div className="profile-page">
        <p className="muted">Loading local profile…</p>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <header className="profile-hero">
        <div className="profile-identity">
          <div className="profile-avatar" aria-hidden>
            {initials(profile.displayName)}
          </div>
          <div>
            <div className="profile-eyebrow">Local profile · no account</div>
            {!editing ? (
              <>
                <h1>{profile.displayName}</h1>
                <p className="profile-handle">@{profile.handle}</p>
                <p className="profile-note">
                  Everything below lives in this browser. Sign-in and synced libraries come later —
                  for now this is your private shelf.
                </p>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>
                  Edit local identity
                </button>
              </>
            ) : (
              <form
                className="profile-edit"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveIdentity();
                }}
              >
                <label>
                  Display name
                  <input
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    maxLength={48}
                    autoComplete="nickname"
                  />
                </label>
                <label>
                  Handle
                  <input
                    value={draftHandle}
                    onChange={(e) => setDraftHandle(e.target.value)}
                    maxLength={32}
                    autoComplete="username"
                    spellCheck={false}
                  />
                </label>
                <div className="profile-edit-actions">
                  <button type="submit" className="btn btn-primary btn-sm">
                    Save on device
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setDraftName(profile.displayName);
                      setDraftHandle(profile.handle);
                      setEditing(false);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        <div className="profile-stats" aria-label="Local collection counts">
          <div>
            <strong>{savedItems.length}</strong>
            <span>Saved</span>
          </div>
          <div>
            <strong>{localPubs.length}</strong>
            <span>Published</span>
          </div>
          <div>
            <strong>{workbench ? 1 : 0}</strong>
            <span>Compose draft</span>
          </div>
        </div>
      </header>

      {notice ? (
        <p className="profile-notice" role="status">
          {notice}
        </p>
      ) : null}

      <div className="profile-grid">
        <section className="profile-panel">
          <div className="profile-panel-head">
            <h2>Saved collection</h2>
            {savedIds.length > 0 ? (
              <button type="button" className="btn btn-ghost btn-sm" onClick={clearSaved}>
                Clear all
              </button>
            ) : null}
          </div>
          <p className="profile-panel-lead">
            Favourites from Discover — NeuroBlocks, datasets, stacks, and provenance references.
          </p>

          {!savedIds.length ? (
            <div className="profile-empty">
              <h3>Nothing saved yet</h3>
              <p>Bookmark modules and datasets from Discover. They stay on this device only.</p>
              <Link href="/explore?saved=1" className="btn btn-primary btn-sm">
                Open Discover
              </Link>
            </div>
          ) : (
            <div className="profile-groups">
              {grouped.map((g) => (
                <div key={g.kind} className="profile-group">
                  <h3>
                    {KIND_LABELS[g.kind]}
                    <span>{g.items.length}</span>
                  </h3>
                  <ul>
                    {g.items.map((item) => (
                      <li key={item.id}>
                        <Link href={repoHref(item)} className="profile-row">
                          <div>
                            <strong>
                              {item.owner}/{item.name}
                            </strong>
                            <span>{item.description}</span>
                            <small>
                              v{item.version} · {item.task}
                              {item.bytes ? ` · ${formatBytes(item.bytes)}` : ""}
                            </small>
                          </div>
                        </Link>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => unsave(item.id)}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {missingSaved.length > 0 ? (
                <div className="profile-group">
                  <h3>
                    Unavailable
                    <span>{missingSaved.length}</span>
                  </h3>
                  <ul>
                    {missingSaved.map((id) => (
                      <li key={id}>
                        <div className="profile-row">
                          <div>
                            <strong>{id}</strong>
                            <span>No longer in the local catalog.</span>
                          </div>
                        </div>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => unsave(id)}>
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </section>

        <aside className="profile-side">
          <section className="profile-panel">
            <div className="profile-panel-head">
              <h2>Compose draft</h2>
            </div>
            {workbench ? (
              <div className="profile-draft">
                <strong>
                  {workbench.name}@{workbench.version}
                </strong>
                <p>
                  {workbench.nodeCount} nodes · {workbench.edgeCount} wires
                </p>
                <div className="profile-chips">
                  {workbench.nodes.slice(0, 8).map((n) => (
                    <span key={n}>{n}</span>
                  ))}
                </div>
                <Link href="/compose" className="btn btn-primary btn-sm">
                  Open in Compose
                </Link>
              </div>
            ) : (
              <div className="profile-empty profile-empty--compact">
                <h3>No draft on this device</h3>
                <p>Save a stack from Compose to see it here.</p>
                <Link href="/compose" className="btn btn-ghost btn-sm">
                  Open Compose
                </Link>
              </div>
            )}
          </section>

          <section className="profile-panel">
            <div className="profile-panel-head">
              <h2>Local publications</h2>
            </div>
            <p className="profile-panel-lead">Releases you published into this machine’s library.</p>
            {localPubs.length ? (
              <ul className="profile-pub-list">
                {localPubs.map((item) => (
                  <li key={item.id}>
                    <Link href={repoHref(item)}>
                      <strong>
                        {item.owner}/{item.name}
                      </strong>
                      <span>
                        v{item.version} · {KIND_LABELS[item.kind]}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="profile-empty profile-empty--compact">
                <h3>No local releases</h3>
                <p>Publish a NeuroBlock to keep a versioned copy on this machine.</p>
                <Link href="/explore/publish" className="btn btn-ghost btn-sm">
                  Publish a release
                </Link>
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
