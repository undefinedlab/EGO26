import { redirect } from "next/navigation";
import { SIMULATE_HREF } from "@/lib/nav";

/** Simulate lives under Verify — keep the old URL working. */
export default async function SimulateAlias({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (Array.isArray(value)) for (const item of value) q.append(key, item);
    else if (value) q.set(key, value);
  }
  const suffix = q.size ? `?${q}` : "";
  redirect(`${SIMULATE_HREF}${suffix}`);
}
