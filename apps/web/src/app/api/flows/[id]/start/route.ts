import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { ATTACHMENT_LIMITS } from "@clauderon/core";
import { memberFromCookies } from "../../../../../server/access";
import { deps, sessionSecret } from "../../../../../server/runtime";
import { startFromForm } from "../../../../../server/start";

export const dynamic = "force-dynamic";

// Room for the form's text fields on top of the files.
const MAX_BODY = ATTACHMENT_LIMITS.runBytes + 1024 * 1024;

/**
 * Starts a plan or summary Flow with its text, links and attached files in one multipart
 * request (ADR 0011): a server action takes 1 MB, attachments up to 25 MB.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Server actions check the Origin themselves; a route handler must, so another site cannot start Runs with the Member's cookie.
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).host !== (request.headers.get("x-forwarded-host") ?? request.headers.get("host"))) {
    return NextResponse.json({ ok: false, error: "Start the Run from the app." }, { status: 403 });
  }
  const store = await cookies();
  const live = await memberFromCookies(deps(), (name) => store.get(name)?.value);
  if (!live) return NextResponse.json({ ok: false, error: "Sign in again." }, { status: 401 });
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY) {
    return NextResponse.json({ ok: false, error: "Attached files are at most 25 MB together." }, { status: 413 });
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "The form could not be read. Try again." }, { status: 400 });
  }
  const { id } = await params;
  const result = await startFromForm(deps(), live.member, id, form, sessionSecret());
  if (result.ok) revalidatePath("/runs");
  return NextResponse.json(result, { status: result.ok ? 200 : 400, headers: { "cache-control": "no-store" } });
}
