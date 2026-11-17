import { applyPodLogins, applyPodStatus, getPod, listProjects, type Db, type GatewayCommand } from "@clauderon/db";
import type { Payload } from "@clauderon/protocol";
import type { RunEngine, Sender } from "./run-engine";

export type PodServiceOptions = { db: Db; link: Sender; engine: RunEngine; log?: (message: string) => void };

/**
 * Pods on the Gateway side (spec M1 §2): turns the web app's commands into
 * Host Agent messages, records `pod.status` and `pod.logins`, and runs the
 * scheduler after every change.
 */
export class PodService {
  constructor(private readonly opts: PodServiceOptions) {}

  async command(command: GatewayCommand): Promise<void> {
    if (command.type === "schedule") return this.opts.engine.schedule(command.podId);
    const pod = await getPod(this.opts.db, command.podId);
    if (!pod) return;
    if (command.type === "pod.checkLogins") {
      this.opts.link.send("pod.checkLogins", { podId: pod.id });
      return;
    }
    this.opts.link.send(command.type, { podId: pod.id, image: pod.imageTag, cpus: pod.cpus, memoryMb: pod.memoryMb });
  }

  async status(status: Payload<"pod.status">): Promise<void> {
    if (status.error) this.log(`pod ${status.podId}: ${status.error}`);
    const before = await getPod(this.opts.db, status.podId);
    const pod = await applyPodStatus(this.opts.db, status);
    if (!pod) return;
    // Starting a Pod triggers a login check (spec M1 §2.2).
    if (pod.status === "running" && before?.status !== "running") this.opts.link.send("pod.checkLogins", { podId: pod.id });
    await this.opts.engine.schedule(pod.id);
  }

  async logins(logins: Payload<"pod.logins">): Promise<void> {
    // Only the Projects' repositories are kept (spec M1 §2.4).
    const projects = new Set((await listProjects(this.opts.db)).map((p) => `${p.owner}/${p.repo}`.toLowerCase()));
    const pod = await applyPodLogins(this.opts.db, {
      ...logins,
      tokenRepos: logins.tokenRepos.filter((r) => projects.has(r.toLowerCase())),
      checkedAt: new Date(logins.checkedAt),
    });
    if (pod) await this.opts.engine.loginsChecked(pod);
  }

  private log(message: string): void {
    (this.opts.log ?? console.warn)(message);
  }
}
