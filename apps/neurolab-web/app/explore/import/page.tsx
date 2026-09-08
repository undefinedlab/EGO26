import {Shell} from "@/components/Shell";
import {BrainImport} from "@/components/BrainImport";
import "../library.css";

export const metadata = {title: "Import a brain"};

export default function ImportBrainPage() {
  return (
    <Shell wide>
      <BrainImport />
    </Shell>
  );
}
