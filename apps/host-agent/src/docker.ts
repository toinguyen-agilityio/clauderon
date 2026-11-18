// The Docker operations the Host Agent needs, so tests run the real Host
// Agent against a fake Docker client (spec "test seam").

export type ContainerSpec = {
  name: string;
  image: string;
  volume: string;
  cpus: number;
  memoryMb: number;
  user: string;
};

export type ExecOptions = {
  user: string;
  workdir?: string;
  env?: Record<string, string>;
};

export type OutputListener = (stream: "stdout" | "stderr", text: string) => void;

/** An interactive exec under a TTY, for the web terminal (POD-9). */
export interface TtySession {
  write(data: string): void;
  resize(cols: number, rows: number): Promise<void>;
  /** Ends the shell; `onExit` fires once it has gone. */
  close(): void;
  onData(listener: (data: string) => void): void;
  onExit(listener: (exitCode: number) => void): void;
}

export interface DockerClient {
  /** Creates the container (and its named volume) if missing; returns its id. */
  createContainer(spec: ContainerSpec): Promise<string>;
  startContainer(name: string): Promise<void>;
  stopContainer(name: string): Promise<void>;
  /** Removes a container, stopping it first; a missing one is fine. */
  removeContainer(name: string): Promise<void>;
  /** Removes a named volume; a missing one is fine. */
  removeVolume(name: string): Promise<void>;
  /** Containers whose name starts with `prefix`, running or not (for heartbeats and orphan kills). */
  listContainers(prefix: string): Promise<{ name: string; running: boolean }[]>;
  /** The digest of the image a container runs, or null when unknown. */
  imageDigest(image: string): Promise<string | null>;
  /** Runs a command in a container, streaming its output; resolves with the exit code. */
  exec(container: string, argv: readonly string[], options: ExecOptions, onOutput?: OutputListener): Promise<number>;
  openTty(container: string, argv: readonly string[], options: ExecOptions & { cols: number; rows: number }): Promise<TtySession>;
}

export const POD_USER = "pod";
export const CONTAINER_PREFIX = "clauderon-pod-";
export const containerName = (podId: string) => `${CONTAINER_PREFIX}${podId}`;
export const volumeName = (podId: string) => `clauderon-ws-${podId}`;

/** Runs a command and collects its stdout; throws with stderr on a non-zero exit. */
export async function execText(docker: DockerClient, container: string, argv: readonly string[], options: ExecOptions): Promise<string> {
  let stdout = "";
  let stderr = "";
  const code = await docker.exec(container, argv, options, (stream, text) => {
    if (stream === "stdout") stdout += text;
    else stderr += text;
  });
  if (code !== 0) throw new Error(`${argv.join(" ")} exited ${code}: ${stderr.trim()}`);
  return stdout;
}
