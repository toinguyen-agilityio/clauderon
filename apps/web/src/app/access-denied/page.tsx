import { cookies } from "next/headers";
import Link from "next/link";
import { DENIED_EMAIL_COOKIE } from "../../auth";

export const dynamic = "force-dynamic";

export default async function AccessDeniedPage() {
  const email = (await cookies()).get(DENIED_EMAIL_COOKIE)?.value;
  return (
    <main>
      <h1>Access denied</h1>
      <p>
        {email ? (
          <>
            <strong>{email}</strong> is not on the allowlist, or Google has not verified it.
          </>
        ) : (
          "This Google account cannot sign in."
        )}
      </p>
      <p className="muted">Ask the Operator to add your email, then sign in again.</p>
      <Link className="button" href="/sign-in">
        Back to sign in
      </Link>
    </main>
  );
}
