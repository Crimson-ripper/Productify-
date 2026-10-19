// What a renter can do with a machine right now, from the backend's `availability`
// field (available | in_use | paused | offline). Older responses only had is_online.
export function availabilityOf(r) {
  if (r?.availability) return r.availability;
  return r?.is_online ? "available" : "offline";
}

const LABELS = {
  available: ["Available now", "online"],
  in_use: ["In use", "busy"],
  paused: ["Paused by owner", "busy"],
  offline: ["Offline", ""],
};

export const UNAVAILABLE_REASON = {
  in_use: "Another renter is using this machine right now. Try another machine, or check back later.",
  paused: "The owner has paused this machine, so it isn't taking new rentals right now.",
  offline: "This machine is offline right now, so nothing can run on it until its owner reconnects it.",
};

export default function Availability({ r }) {
  const a = availabilityOf(r);
  const [label, tone] = LABELS[a] || LABELS.offline;
  return (
    <span className={`node-status ${tone}`.trim()}>
      <span className={a === "available" ? "live-dot" : a === "offline" ? "live-dot off" : "live-dot busy"} />{label}
    </span>
  );
}
