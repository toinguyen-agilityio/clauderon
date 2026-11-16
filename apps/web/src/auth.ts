import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { cookies } from "next/headers";
import { checkGoogleSignIn } from "./server/access";
import { clauderonAdapter } from "./server/auth-adapter";
import { deps } from "./server/runtime";

export const DENIED_EMAIL_COOKIE = "clauderon.denied-email";
const DAY_SECONDS = 24 * 60 * 60;

export const { handlers, signIn, signOut } = NextAuth(() => {
  const { db, operators, clock } = deps();
  return {
    adapter: clauderonAdapter(db, operators, clock),
    secret: process.env.SESSION_SECRET,
    trustHost: true,
    providers: [
      Google({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        // Safe here: Google is the only provider and the email must be
        // verified. The signIn callback creates the Member first.
        allowDangerousEmailAccountLinking: true,
      }),
    ],
    // Server-side sessions, 24 hours from sign-in, never extended (MEM-1).
    session: { strategy: "database", maxAge: DAY_SECONDS, updateAge: DAY_SECONDS },
    pages: { signIn: "/sign-in", error: "/access-denied" },
    callbacks: {
      async signIn({ profile }) {
        const result = await checkGoogleSignIn({ db, operators, clock }, profile ?? undefined);
        if (result.ok) return true;
        // Shown on the access denied page; kept out of the URL.
        if (result.email) {
          (await cookies()).set(DENIED_EMAIL_COOKIE, result.email, { httpOnly: true, sameSite: "lax", secure: true, maxAge: 300, path: "/" });
        }
        return "/access-denied";
      },
    },
  };
});
