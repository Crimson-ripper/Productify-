// Fallback copy of the backend's INSTANCE_TEMPLATES (GET /instances/templates).
// Only what Productify Node v2 actually runs — see CLAUDE.md §3 rule 4.
export const DEFAULT_TEMPLATES = [
  {
    id: "jupyter-pytorch",
    name: "PyTorch (CUDA)",
    category: "AI development",
    description: "Python with PyTorch and CUDA on the machine's NVIDIA GPU. Run commands from the browser terminal. JupyterLab is on the way.",
    service_name: "Browser terminal",
  },
  {
    id: "ubuntu-base",
    name: "Python",
    category: "General",
    description: "A plain Python environment for scripts and tools. Run commands from the browser terminal.",
    service_name: "Browser terminal",
  },
];
