import { redirect } from "next/navigation";

/** Compile lives on Compose — keep the old URL working. */
export default function CompilePage() {
  redirect("/compose");
}
