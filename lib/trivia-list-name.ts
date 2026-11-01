/**
 * Generated trivia lists are all named from their question count
 * ("Trivia Question List (5)"), so generating a second same-size list in a
 * project would create an indistinguishable duplicate name. When the base
 * name is already taken, append " (2)", " (3)", … until it is unique.
 * Display-only: the count inside the base name is never changed.
 */
export function uniqueTriviaListName(takenNames: readonly string[], baseName: string): string {
  const taken = new Set(takenNames);
  if (!taken.has(baseName)) return baseName;
  for (let suffix = 2; ; suffix++) {
    const candidate = `${baseName} (${suffix})`;
    if (!taken.has(candidate)) return candidate;
  }
}
