// Projects store updatedAt as an ISO timestamp (stamped on every save).
// Older projects may still carry a legacy display string ("just now",
// "12 min ago") with no real time behind it. Project ids embed their
// creation time (project-<epoch milliseconds>), so for those, show an
// honest creation date instead of a frozen "just now".
export function formatUpdatedAt(value: string, projectId?: string): string {
  const then = Date.parse(value);
  if (Number.isNaN(then)) {
    const match = /^project-(\d{10,})$/.exec(projectId || "");
    if (match) {
      const created = new Date(Number(match[1]));
      if (!Number.isNaN(created.getTime())) return "Created " + created.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    }
    return value;
  }
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(then).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
