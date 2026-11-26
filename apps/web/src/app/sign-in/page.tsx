import { signIn } from "../../auth";
import { Brand } from "../../components/brand";
import { GoogleLogo, Icon } from "../../components/icons";
import { safeReturnPath } from "../../server/runtime";

export const dynamic = "force-dynamic";

/** An illustrative Run on the sign-in hero: what one Flow looks like while it works. */
const STEPS: { name: string; note: string; state: "done" | "running" | "next" }[] = [
  { name: "Issue", note: "#142 opened", state: "done" },
  { name: "Plan", note: "approved by you", state: "done" },
  { name: "Code a change", note: "running · 2m 14s", state: "running" },
  { name: "Run tests", note: "next", state: "next" },
  { name: "Pull request", note: "opened by your Machine", state: "next" },
];

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const redirectTo = safeReturnPath((await searchParams).next) ?? "/";
  return (
    <div className="signin-split">
      <aside className="signin-hero">
        <Brand />
        <div className="signin-pitch">
          <h1>
            From any starting point
            <br />
            to completed work.
          </h1>
          <p>Pick GitHub issues, run them through a Flow on your own Machine, and review what Claude Code did before it reaches main.</p>
        </div>
        <ol className="signin-steps" aria-label="Example Run">
          {STEPS.map((s) => (
            <li key={s.name} className={s.state}>
              <span className="dot" aria-hidden="true">
                {s.state === "done" && Icon.check}
              </span>
              <span className="name">{s.name}</span>
              <span className="note">{s.note}</span>
            </li>
          ))}
        </ol>
        <p className="signin-foot">Every Run is recorded with the email of the Member who started it.</p>
      </aside>
      <main className="signin-main">
        <div className="signin-panel">
          <div className="signin-copy">
            <h1>Sign in</h1>
            <p>
              Use your Google account. Only emails on the team&apos;s allowlist can sign in, and your email is recorded on every Run you
              start and every approval you give.
            </p>
          </div>
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo });
            }}
          >
            <button className="btn lg block" type="submit">
              <GoogleLogo /> Sign in with Google
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
