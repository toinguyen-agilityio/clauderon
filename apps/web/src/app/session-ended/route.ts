import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIES } from "../../server/access";
import { webUrl } from "../../server/runtime";

/** Clears a session cookie the server no longer accepts, then asks to sign in. */
export function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/sign-in", webUrl(request.nextUrl.origin)));
  for (const name of SESSION_COOKIES) response.cookies.delete(name);
  return response;
}
