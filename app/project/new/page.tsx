import { requireCreator } from "../../../lib/auth/server";
import { canUseCityCrimeScene } from "../../../lib/city-crime-scene";
import NewProjectFlow from "./flow";

export const dynamic = "force-dynamic";

// Server wrapper: the City Crime Scene option in the Gameshow popup is
// rendered only when the signed-in account is entitled, decided here with
// the same server-side entitlement check the rest of the site uses
// (PR #126 pattern: a server-computed boolean — the option simply does
// not exist in the page for anyone else). The new project is owned by its
// creator, so the creator's own entitlement is the right verdict.
export default async function NewProjectPage() {
  let ccssEntitled = false;
  // The Coming Soon gate's exemption is decided here too. Radio's
  // exemption is an entitlement of exactly two accounts (Jessica,
  // 2026-11-25 — see canUseRadioKind in lib/project-kinds), keyed on
  // the account EMAIL, not the admin role, so the flow receives the
  // viewer's own email and the gate predicate (isKindGatedFor) applies
  // the rule; an unknown email resolves closed.
  let viewerEmail: string | null = null;
  try {
    const user = await requireCreator();
    ccssEntitled = canUseCityCrimeScene(user?.email);
    viewerEmail = user?.email ?? null;
  } catch {
    ccssEntitled = false;
    viewerEmail = null;
  }
  return <NewProjectFlow ccssEntitled={ccssEntitled} viewerEmail={viewerEmail} />;
}
