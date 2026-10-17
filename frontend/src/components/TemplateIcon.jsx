import { FlaskConical, Image, MessageSquare, Terminal } from "lucide-react";

const ICONS = {
  "jupyter-pytorch": FlaskConical,
  "comfyui-sdxl": Image,
  "ollama-llm": MessageSquare,
};

// Icon for a GPU instance template (falls back to a terminal for plain Linux / custom images).
export default function TemplateIcon({ id, size = 18 }) {
  const Icon = ICONS[id] || Terminal;
  return <Icon size={size} aria-hidden="true" />;
}
