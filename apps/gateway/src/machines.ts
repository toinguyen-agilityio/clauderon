import { applyMachineDoctor, applyMachineLogins, listProjects, type Db, type GatewayCommand } from "@clauderon/db";
import type { Payload } from "@clauderon/protocol";
import type { MachineLinks } from "./machine-link";
import type { RunEngine } from "./run-engine";

export type MachineServiceOptions = { db: Db; links: MachineLinks; engine: RunEngine; log?: (message: string) => void };

/**
 * Machines on the Gateway side (ADR 0006): turns the web app's commands into
 * Agent messages and Run engine calls, and records `machine.logins` and
 * `machine.doctor`.
 */
export class MachineService {
  constructor(private readonly opts: MachineServiceOptions) {}

  async command(command: GatewayCommand): Promise<void> {
    switch (command.type) {
      case "schedule":
        return this.opts.engine.schedule(command.machineId);
      case "run.cancel":
        return this.opts.engine.cancelled(command);
      case "run.resume":
        return this.opts.engine.resume(command.runId);
      case "machine.checkLogins":
        this.opts.links.send(command.machineId, "machine.checkLogins", {});
        return;
      case "machine.repaired":
        // The old computer cannot report any more: its Runs end as Interrupted.
        await this.opts.links.repaired(command.machineId);
        return this.opts.engine.machineLost(command.machineId, "The Machine was paired anew");
    }
  }

  async logins(logins: Payload<"machine.logins">, machineId: string): Promise<void> {
    // Only the Projects' repositories are kept (spec M1 §2.4).
    const projects = new Set((await listProjects(this.opts.db)).map((p) => `${p.owner}/${p.repo}`.toLowerCase()));
    const machine = await applyMachineLogins(this.opts.db, {
      machineId,
      ...logins,
      tokenRepos: logins.tokenRepos.filter((r) => projects.has(r.toLowerCase())),
      checkedAt: new Date(logins.checkedAt),
    });
    if (machine) await this.opts.engine.loginsChecked(machine);
  }

  /** Keeps the doctor's report for the Machine page (ADR 0007). */
  async doctor(report: Payload<"machine.doctor">, machineId: string): Promise<void> {
    await applyMachineDoctor(this.opts.db, machineId, report);
  }
}
