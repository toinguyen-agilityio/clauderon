import { redirect } from "next/navigation";

/** The Allowlist page became the Members page; old links still land there. */
export default function AllowlistPage() {
  redirect("/members");
}
