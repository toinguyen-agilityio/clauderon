import { ThemeToggle } from "../../components/theme-toggle";
import type { ReactNode } from "react";
import { isOperator } from "@clauderon/db";
import { signOut } from "../../auth";
import { Avatar, Brand } from "../../components/brand";
import { SideNav } from "../../components/side-nav";
import { deps, requireMember } from "../../server/runtime";

/** The signed-in shell of the prototype: left rail, work area on the right. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const member = await requireMember();
  const operator = isOperator(member.email, deps().operators);

  return (
    <div className="shell">
      <aside className="side">
        <Brand />
        <SideNav operator={operator} />
        <div className="side-foot">
          <div className="me">
            <Avatar name={member.name} email={member.email} picture={member.pictureUrl} />
            <div className="me-text grow">
              <div style={{ fontWeight: 600 }}>{member.name ?? member.email}</div>
              <div className="small faint" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                {member.email}
              </div>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/sign-in" });
                }}
              >
                <button type="submit" className="btn link">
                  Sign out
                </button>
              </form>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </aside>
      <main className="main">
        <div className="view">{children}</div>
      </main>
    </div>
  );
}
