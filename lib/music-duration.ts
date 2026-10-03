export function musicDuration(prompt: string, explicit?: unknown): number | null {
  if (explicit === 0) return null;
  if (explicit != null) return Number(explicit);
  const match = prompt.match(/\b(\d{1,3})(?:\s*(?:to|[-–])\s*(\d{1,3}))?\s*[- ]?\s*(?:seconds?|secs?|s)\b/i);
  if (match) return Number(match[2] || match[1]);
  if (/\b(full[- ]length|full song|complete song)\b/i.test(prompt)) return null;
  if (/\b(short|intro|jingle|sting|bumper)\b/i.test(prompt)) return 25;
  return null;
}
