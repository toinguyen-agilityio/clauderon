import { cookies } from "next/headers";
import Link from "next/link";
import { DENIED_EMAIL_COOKIE } from "../../auth";
import { Brand } from "../../components/brand";

export const dynamic = "force-dynamic";

export default async function AccessDeniedPage() {
  const email = (await cookies()).get(DENIED_EMAIL_COOKIE)?.value;
  return (
    <div className="signin">
      <div className="card signin-card">
        <Brand />
        <div className="stack" style={{ gap: 6 }}>
          <h1>Access denied</h1>
          <p className="muted">
            {email ? (
              <>
                <b>{email}</b> is not on this app&apos;s allowlist, or Google has not verified it.
              </>
            ) : (
              "This Google account is not on this app's allowlist."
            )}{" "}
            Ask whoever runs Clauderon to add your email, then sign in again.
          </p>
        </div>
        <Link className="btn primary" href="/sign-in" style={{ justifyContent: "center" }}>
          Use another Google account
        </Link>
      </div>
    </div>
  );
}
