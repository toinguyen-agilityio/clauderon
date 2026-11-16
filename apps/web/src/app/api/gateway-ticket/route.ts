import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIES } from "../../../server/access";
import { gatewayTicket } from "../../../server/gateway-ticket";
import { deps, sessionSecret } from "../../../server/runtime";

export const dynamic = "force-dynamic";

export async function GET() {
  const store = await cookies();
  const result = await gatewayTicket(deps(), (name) => store.get(name)?.value, sessionSecret());
  if (result.status === 200) return NextResponse.json({ ticket: result.ticket }, { headers: { "cache-control": "no-store" } });

  const response = NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (result.clearCookies) for (const name of SESSION_COOKIES) response.cookies.delete(name);
  return response;
}
