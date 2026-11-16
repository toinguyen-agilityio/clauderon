import { signIn } from "../../auth";
import { Brand } from "../../components/brand";
import { GoogleLogo } from "../../components/icons";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  return (
    <div className="signin">
      <div className="card signin-card">
        <Brand />
        <div className="stack" style={{ gap: 6 }}>
          <h1>Sign in</h1>
          <p className="muted">
            Use your Google account. Only emails on the team&apos;s allowlist can sign in, and your email is recorded on every Run you
            start and every approval you give.
          </p>
        </div>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <button className="btn" type="submit" style={{ justifyContent: "center", gap: 10, height: 44, width: "100%" }}>
            <GoogleLogo /> Sign in with Google
          </button>
        </form>
      </div>
    </div>
  );
}
