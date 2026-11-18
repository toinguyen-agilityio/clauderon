import { PassThrough } from "node:stream";
import { StringDecoder } from "node:string_decoder";
import Docker from "dockerode";
import type { ContainerSpec, DockerClient, ExecOptions, OutputListener, TtySession } from "./docker";

const toEnv = (env: Record<string, string> = {}) => Object.entries(env).map(([k, v]) => `${k}=${v}`);

function isStatus(error: unknown, code: number): boolean {
  return (error as { statusCode?: number })?.statusCode === code;
}

/** The Docker Engine API over the local socket (dockerode). */
export function dockerEngine(docker = new Docker()): DockerClient {
  const pull = async (image: string) => {
    const stream = await docker.pull(image);
    await new Promise<void>((resolve, reject) => docker.modem.followProgress(stream, (error) => (error ? reject(error) : resolve())));
  };

  return {
    async createContainer(spec: ContainerSpec) {
      const existing = docker.getContainer(spec.name);
      try {
        return (await existing.inspect()).Id;
      } catch (error) {
        if (!isStatus(error, 404)) throw error;
      }
      try {
        await docker.getImage(spec.image).inspect();
      } catch (error) {
        if (!isStatus(error, 404)) throw error;
        await pull(spec.image);
      }
      await docker.createVolume({ Name: spec.volume }).catch((error: unknown) => {
        if (!isStatus(error, 409)) throw error;
      });
      const container = await docker.createContainer({
        name: spec.name,
        Image: spec.image,
        User: spec.user,
        Cmd: ["sleep", "infinity"],
        WorkingDir: "/workspace",
        HostConfig: {
          NanoCpus: Math.round(spec.cpus * 1e9),
          Memory: spec.memoryMb * 1024 * 1024,
          Mounts: [{ Type: "volume", Source: spec.volume, Target: "/workspace" }],
          RestartPolicy: { Name: "unless-stopped" },
        },
      });
      return container.id;
    },

    async startContainer(name) {
      await docker
        .getContainer(name)
        .start()
        .catch((error: unknown) => {
          if (!isStatus(error, 304)) throw error; // already running
        });
    },

    async stopContainer(name) {
      await docker
        .getContainer(name)
        .stop()
        .catch((error: unknown) => {
          if (!isStatus(error, 304)) throw error; // already stopped
        });
    },

    async listContainers(prefix) {
      const list = await docker.listContainers({ all: true, filters: { name: [prefix] } });
      return list.flatMap((c) =>
        (c.Names ?? [])
          .map((n) => n.replace(/^\//, ""))
          .filter((n) => n.startsWith(prefix))
          .map((name) => ({ name, running: c.State === "running" })),
      );
    },

    async removeContainer(name) {
      await docker
        .getContainer(name)
        .remove({ force: true })
        .catch((error: unknown) => {
          if (!isStatus(error, 404)) throw error;
        });
    },

    async removeVolume(name) {
      await docker
        .getVolume(name)
        .remove()
        .catch((error: unknown) => {
          if (!isStatus(error, 404)) throw error;
        });
    },

    async imageDigest(image) {
      const info = await docker.getImage(image).inspect();
      return info.RepoDigests?.[0]?.split("@")[1] ?? info.Id ?? null;
    },

    async exec(container, argv, options: ExecOptions, onOutput?: OutputListener) {
      const exec = await docker.getContainer(container).exec({
        Cmd: [...argv],
        User: options.user,
        WorkingDir: options.workdir,
        Env: toEnv(options.env),
        AttachStdout: true,
        AttachStderr: true,
      });
      const stream = await exec.start({ hijack: true, stdin: false });
      const stdout = new PassThrough();
      const stderr = new PassThrough();
      const out = new StringDecoder("utf8");
      const err = new StringDecoder("utf8");
      stdout.on("data", (chunk: Buffer) => onOutput?.("stdout", out.write(chunk)));
      stderr.on("data", (chunk: Buffer) => onOutput?.("stderr", err.write(chunk)));
      docker.modem.demuxStream(stream, stdout, stderr);
      await new Promise<void>((resolve, reject) => {
        stream.on("end", resolve);
        stream.on("close", resolve);
        stream.on("error", reject);
      });
      return (await exec.inspect()).ExitCode ?? -1;
    },

    async openTty(container, argv, options) {
      const exec = await docker.getContainer(container).exec({
        Cmd: [...argv],
        User: options.user,
        WorkingDir: options.workdir,
        Env: toEnv({ TERM: "xterm-256color", ...options.env }),
        AttachStdin: true,
        AttachStdout: true,
        AttachStderr: true,
        Tty: true,
      });
      const stream = await exec.start({ hijack: true, stdin: true, Tty: true });
      await exec.resize({ w: options.cols, h: options.rows }).catch(() => {});
      const decoder = new StringDecoder("utf8");
      const dataListeners: ((data: string) => void)[] = [];
      const exitListeners: ((code: number) => void)[] = [];
      let ended = false;
      stream.on("data", (chunk: Buffer) => {
        const text = decoder.write(chunk);
        if (text) for (const listener of dataListeners) listener(text);
      });
      const finish = async () => {
        if (ended) return;
        ended = true;
        const code = await exec
          .inspect()
          .then((i) => i.ExitCode ?? 0)
          .catch(() => 0);
        for (const listener of exitListeners) listener(code);
      };
      stream.on("end", () => void finish());
      stream.on("close", () => void finish());

      const session: TtySession = {
        write: (data) => void stream.write(data),
        resize: async (cols, rows) => {
          await exec.resize({ w: cols, h: rows });
        },
        close: () => {
          // Ctrl-C stops what runs in the foreground (a Connect login waiting
          // for its code ignores EOF), then Ctrl-D ends `bash -l`, as closing
          // a terminal window does.
          stream.write("\x03\x04");
          stream.end();
          setTimeout(() => {
            stream.destroy();
            void finish();
          }, 2_000).unref();
        },
        onData: (listener) => void dataListeners.push(listener),
        onExit: (listener) => void exitListeners.push(listener),
      };
      return session;
    },
  };
}
