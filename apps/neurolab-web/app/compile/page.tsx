import "../compose/compose.css";
import {ComposeStudio} from "@/components/ComposeStudio";
import {Shell} from "@/components/Shell";

export default function CompilePage() {
  return <Shell canvas><ComposeStudio mode="compile"/></Shell>;
}
