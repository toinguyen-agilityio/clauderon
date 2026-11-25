import { ThemeToggle } from "../../components/theme-toggle";
import type { ReactNode } from "react";
import { signOut } from "../../auth";
import { Avatar, Brand } from "../../components/brand";
import { Icon } from "../../components/icons";
import { NeedsYouProvider } from "../../components/needs-you-live";
import { needsYouAction } from "./actions";
import { MobileShell } from "../../components/mobile-shell";
import { SideNav } from "../../components/side-nav";
import { needsYouCount } from "../../server/runs";
import { deps, gatewayUrl, requireMember } from "../../server/runtime";

/** The signed-in shell of the prototype: left rail, work area on the right. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const member = await requireMember();
  const needsYou = await needsYouCount(deps());

  return (
    <div className="shell">
      <NeedsYouProvider initial={needsYou} load={needsYouAction} gatewayUrl={gatewayUrl()}>
      <MobileShell needsYou={needsYou}>
        <Brand />
        <SideNav needsYou={needsYou} />
        <div className="side-foot">
          <div className="me">
            <Avatar name={member.name} email={member.email} picture={member.pictureUrl} />
            <div className="me-text grow">
              <div className="me-name clip">{member.name ?? member.email}</div>
              <div className="small faint me-email">{member.email}</div>
            </div>
          </div>
          <div className="side-tools">
            <ThemeToggle />
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/sign-in" });
              }}
            >
              <button type="submit" className="icon-btn" aria-label="Sign out" title="Sign out">
                {Icon.signOut}
              </button>
            </form>
          </div>
        </div>
      </MobileShell>
      </NeedsYouProvider>
      <main className="main">
        <div className="view">{children}</div>
      </main>
    </div>
  );
}
