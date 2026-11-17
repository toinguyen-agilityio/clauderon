import { POD_USER, containerName, type DockerClient, type TtySession } from "./docker";
import type { AgentLink, Log } from "./pods";

/**
 * Web terminals (spec M1 §2.5): `docker exec -it -u pod <container> bash -l`
 * under a TTY per session. Keystrokes and output are relayed, never stored or
 * logged.
 */
export function registerTerminalHandlers(link: AgentLink, docker: DockerClient, log: Log): void {
  const sessions = new Map<string, TtySession>();
  const opening = new Set<string>();
  const closing = new Set<string>();

  link.on("terminal.open", ({ sessionId, podId, cols, rows }) => {
    opening.add(sessionId);
    void (async () => {
      try {
        const tty = await docker.openTty(containerName(podId), ["bash", "-l"], { user: POD_USER, workdir: "/workspace", cols: cols ?? 80, rows: rows ?? 24 });
        opening.delete(sessionId);
        sessions.set(sessionId, tty);
        tty.onData((data) => link.send("terminal.output", { sessionId, data }));
        tty.onExit((exitCode) => {
          sessions.delete(sessionId);
          closing.delete(sessionId);
          link.send("terminal.closed", { sessionId, exitCode });
        });
        // Closed before the shell was up.
        if (closing.has(sessionId)) tty.close();
      } catch (error) {
        opening.delete(sessionId);
        closing.delete(sessionId);
        log(`terminal ${sessionId} on pod ${podId} failed: ${error instanceof Error ? error.message : String(error)}`);
        link.send("terminal.closed", { sessionId, exitCode: -1 });
      }
    })();
  });

  link.on("terminal.input", ({ sessionId, data }) => {
    if (data) sessions.get(sessionId)?.write(data);
  });

  link.on("terminal.resize", ({ sessionId, cols, rows }) => {
    if (cols && rows) void sessions.get(sessionId)?.resize(cols, rows).catch(() => {});
  });

  link.on("terminal.close", ({ sessionId }) => {
    const tty = sessions.get(sessionId);
    if (tty) tty.close();
    else if (opening.has(sessionId)) closing.add(sessionId);
    // Already gone: still answer, so the Gateway runs its login check.
    else link.send("terminal.closed", { sessionId });
  });
}
