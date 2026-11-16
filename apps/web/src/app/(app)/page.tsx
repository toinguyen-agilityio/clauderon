import { redirect } from "next/navigation";

// Tickets becomes the landing page in M1; until then the Pod Host is the only module.
export default function Home() {
  redirect("/pods");
}
