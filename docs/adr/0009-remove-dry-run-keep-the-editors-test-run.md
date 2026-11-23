# Remove Dry-run; keep the editor's Test run

Two features let a Member watch a Flow play without executing anything: **Dry-run** (a Run mode in the Start dialog, simulated in the Gateway and stored as a real Run) and the **Test run** (a button in the Flow editor that runs in the browser and stores nothing). They overlapped and Members could not tell which to use. Dry-run also cost code and rules: a simulated runner in the Gateway, a `mode` on every Run and Batch, an Active Run exclusion, an "(including Dry-runs)" clause in the Flow lock, and extra paths in the Start dialog. Its name clashed with the editor's Test run.

**Decision:** remove Dry-run and keep the editor's Test run unchanged.

- **Removed**: the Real / Dry-run choice in the Start dialog, the Dry-run badges, the simulated runner and the `DRY_RUN_FAILURE_RATE` setting in the Gateway (so a Gateway restart no longer touches such Runs), the `mode` field in Ticket Status, and the `run_mode` enum with the `mode` columns of `run` and `batch`.
- **Existing data**: migration `0011_remove_dry_run` deletes Dry-run Runs and Batches (they never touched GitHub or Claude; their Attempts, logs and Outputs cascade), rebuilds the one-Active-Run-per-Ticket index without the `mode` condition, and drops the columns and the enum.
- **Kept**: core's `simulate.ts`, which the editor's Test run still uses to make up Outputs.
- **Queue and Slots**: the only thing Dry-run exercised that Test run does not was the queue and Slots with many Runs (requirement A2, risk R4). A2 is now checked by a Gateway test with a fake Agent that holds Nodes open: 10 Tickets on 2 Slots never run more than 2 at once and start first in, first out.
- **Deploy order**: the migration drops columns that the previous web code still writes, so deploy web and Gateway together with the migration (the usual `pnpm db:migrate` step), as for any schema change.

## Considered Options

- **Keep Dry-run, remove Test run**: Dry-run exercises the real Run engine, but it needs a Machine, takes a Slot, is stored as a Run and carries rules through the whole codebase.
- **Keep both and rename**: removes the name clash but not the cost or the overlap.
