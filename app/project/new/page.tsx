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
  try {
    const user = await requireCreator();
    ccssEntitled = canUseCityCrimeScene(user?.email);
  } catch {
    ccssEntitled = false;
  }
  return <NewProjectFlow ccssEntitled={ccssEntitled} />;
}
