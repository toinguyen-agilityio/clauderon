import type { MessageType, Payload } from "@clauderon/protocol";
import { POD_USER, containerName, execText, volumeName, type DockerClient } from "./docker";

/** The part of the Host Agent the handlers use: register handlers, send messages. */
export interface AgentLink {
  on<T extends MessageType>(type: T, handler: (payload: Payload<T>) => void | Promise<void>): void;
  send<T extends MessageType>(type: T, payload: Payload<T>): unknown;
}

export type Log = (message: string) => void;

/**
 * Runs a handler without holding the link's queue: creating a container,
 * cloning or running a Node can take minutes, and terminals must stay live.
 */
export function detached<T>(handler: (payload: T) => Promise<void>): (payload: T) => void {
  return (payload) => {
    void handler(payload);
  };
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Pods (spec M1 §2.1, §2.2): one container per Pod with its own named volume
 * at /workspace, the row's CPU and memory limits, user `pod`. Every command is
 * answered with `pod.status`.
 */
export function registerPodHandlers(link: AgentLink, docker: DockerClient, log: Log): void {
  const status = async (podId: string, image: string, state: "running" | "stopped", containerId: string | null) => {
    const imageDigest = state === "running" ? await docker.imageDigest(image).catch(() => null) : null;
    link.send("pod.status", { podId, status: state, containerId, imageDigest });
  };
  const failed = (podId: string, error: unknown) => {
    log(`pod ${podId}: ${message(error)}`);
    link.send("pod.status", { podId, status: "error", containerId: null, imageDigest: null, error: message(error) });
  };

  link.on("pod.create", detached(async ({ podId, image, cpus, memoryMb }) => {
    try {
      const id = await docker.createContainer({ name: containerName(podId), image, volume: volumeName(podId), cpus, memoryMb, user: POD_USER });
      await docker.startContainer(containerName(podId));
      await status(podId, image, "running", id);
    } catch (error) {
      failed(podId, error);
    }
  }));

  link.on("pod.start", detached(async ({ podId, image }) => {
    try {
      await docker.startContainer(containerName(podId));
      await status(podId, image, "running", null);
    } catch (error) {
      failed(podId, error);
    }
  }));

  link.on("pod.stop", detached(async ({ podId, image }) => {
    try {
      await docker.stopContainer(containerName(podId));
      await status(podId, image, "stopped", null);
    } catch (error) {
      failed(podId, error);
    }
  }));

  // POD-7: the Pod row is already gone, so there is no status to report.
  // The container goes first, since a volume in use cannot be removed.
  link.on("pod.delete", detached(async ({ podId }) => {
    try {
      await docker.removeContainer(containerName(podId));
      await docker.removeVolume(volumeName(podId));
    } catch (error) {
      log(`pod ${podId}: delete failed: ${message(error)}`);
    }
  }));

  link.on("pod.checkLogins", detached(async ({ podId }) => {
    // checkLogins never throws: each failed check reads as logged out.
    link.send("pod.logins", { podId, ...(await checkLogins(docker, podId)), checkedAt: new Date().toISOString() });
  }));
}

/**
 * The Claude Code login check. The M0 spike has not confirmed a status
 * command yet (docs/specs/notes/claude-headless.md), so this accepts either a
 * status command that exits 0 or a stored credentials file.
 */
export const CLAUDE_STATUS_SCRIPT = 'claude auth status >/dev/null 2>&1 || test -s "$HOME/.claude/.credentials.json"';

/** Login checks as `pod` inside the container (POD-5); never periodic. */
export async function checkLogins(docker: DockerClient, podId: string) {
  const container = containerName(podId);
  const options = { user: POD_USER };
  const run = (argv: string[]) => docker.exec(container, argv, options).catch(() => 1);

  const claude = (await run(["bash", "-lc", CLAUDE_STATUS_SCRIPT])) === 0;
  const gh = (await run(["gh", "auth", "status"])) === 0;
  let ghAccount: string | null = null;
  let tokenRepos: string[] = [];
  if (gh) {
    ghAccount = (await execText(docker, container, ["gh", "api", "user", "--jq", ".login"], options).catch(() => "")).trim() || null;
    // Every repository the login reaches; the Gateway keeps the Projects' ones.
    const repos = await execText(docker, container, ["gh", "api", "user/repos?per_page=100", "--paginate", "--jq", ".[].full_name"], options).catch(() => "");
    tokenRepos = repos.split("\n").map((r) => r.trim()).filter(Boolean);
  }
  return { claude, gh, ghAccount, tokenRepos };
}
