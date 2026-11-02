// Project creator identification is an ADMIN-ONLY signal.
//
// The projects API resolves a project's stored owner_id (the account that
// created it) to that account's email, but the email may only ever be
// disclosed to an admin viewer. Regular users — including the project's own
// owner — always receive null here, and their UI renders no creator line at
// all. (Owners already know their own projects; the label exists so an admin
// can tell whose project is whose.)
//
// This helper is the single place that rule is applied, so the list and
// detail project responses shape creatorEmail identically. A missing or
// unresolvable owner stays null — an email is never invented.
export function creatorEmailForViewer(viewerIsAdmin: boolean, ownerEmail: string | null | undefined): string | null {
  if (!viewerIsAdmin) return null;
  const email = typeof ownerEmail === "string" ? ownerEmail.trim() : "";
  return email ? email : null;
}
