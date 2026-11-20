import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { memberFromCookies } from "../../server/access";
import { deps, webUrl } from "../../server/runtime";

export const dynamic = "force-dynamic";

/**
 * The link a pairing Agent opens (ADR 0006): the Machines page with its code
 * looked up, ready to approve; through sign-in first when needed.
 */
export async function GET(request: NextRequest) {
  const code = (request.nextUrl.searchParams.get("code") ?? "").replace(/[^A-Za-z0-9-]/g, "").slice(0, 12);
  const target = code ? `/machines?code=${code}` : "/machines";
  const store = await cookies();
  const live = await memberFromCookies(deps(), (name) => store.get(name)?.value);
  const to = live ? target : `/sign-in?next=${encodeURIComponent(target)}`;
  // Behind a proxy request.url is the app's own address (localhost:…), so use the public origin.
  return NextResponse.redirect(new URL(to, webUrl(request.nextUrl.origin)));
}
