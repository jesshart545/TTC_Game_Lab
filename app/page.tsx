import { requireCreator } from "../lib/auth/server";
import LandingPage from "./landing";
import HomePage from "./home-page";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  let signedIn = false;
  try {
    signedIn = Boolean(await requireCreator());
  } catch {
    signedIn = false;
  }
  return signedIn ? <HomePage /> : <LandingPage />;
}
