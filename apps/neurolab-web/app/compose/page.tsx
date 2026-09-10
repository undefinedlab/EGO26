import "./compose.css";
import { ComposeStudio } from "@/components/ComposeStudio";
import { Shell } from "@/components/Shell";

export default function ComposePage() {
  return (
    <Shell canvas>
      <ComposeStudio />
    </Shell>
  );
}
