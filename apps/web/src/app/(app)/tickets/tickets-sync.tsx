"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { syncTicketsAction } from "./actions";

/** After the page rendered from the database, syncs GitHub in the background and reloads the Tickets once it changed something. */
export function TicketsSync() {
  const router = useRouter();
  useEffect(() => {
    let live = true;
    syncTicketsAction()
      .then((synced) => {
        if (live && synced) router.refresh();
      })
      .catch(() => {
        // The page keeps showing the last synced Tickets.
      });
    return () => {
      live = false;
    };
  }, [router]);
  return null;
}
