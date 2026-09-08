import { Shell } from "@/components/Shell";
import { ProfileClient } from "@/components/ProfileClient";
import { catalog } from "@/lib/libraryServer";

export const dynamic = "force-dynamic";
export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  return (
    <Shell wide>
      <ProfileClient items={await catalog()} />
    </Shell>
  );
}
