// City Crime Scene entitlement check.
// Full implementation is on main (PR #34). This minimal version provides
// the entitlement gate for the template library branch merge.
const DEFAULT_ENTITLED = ["biscoe1972@gmail.com", "ladylovelace0627@gmail.com"];

export function canUseCityCrimeScene(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.toLowerCase().trim();
  const override = process.env.CITY_CRIME_SCENE_EMAILS;
  const allowed = override
    ? override.split(",").map(e => e.toLowerCase().trim()).filter(Boolean)
    : DEFAULT_ENTITLED;
  return allowed.includes(normalized);
}
