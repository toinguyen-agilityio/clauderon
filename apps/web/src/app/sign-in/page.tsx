import { signIn } from "../../auth";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  return (
    <main>
      <h1>Clauderon</h1>
      <p className="muted">Sign in with the Google account your team added to the allowlist.</p>
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/" });
        }}
      >
        <button className="primary" type="submit">
          Sign in with Google
        </button>
      </form>
    </main>
  );
}
