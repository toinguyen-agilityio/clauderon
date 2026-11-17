import { redirect } from "next/navigation";

// Tickets is the landing page from M1 on.
export default function Home() {
  redirect("/tickets");
}
