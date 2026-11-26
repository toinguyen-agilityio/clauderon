# Flow history is a full snapshot per change, kept forever

Any Member can edit or delete any Flow (FLW-9), and the audit log only says that a Flow was updated, with its name and counts. Members need to see what changed, who changed it, and to get an earlier version or a deleted Flow back (FLW-11, issue #181).

**Decision:** every change to a Flow stores a full snapshot of it in a `flow_version` row, with a summary of what changed worked out when it is stored. Versions are kept forever; there is no cleanup job.

- **Row**: `flow_id` (no foreign key, so history outlives a deleted Flow), `seq` (unique with `flow_id`), `kind` (`create`, `clone`, `import`, `update`, `restore`, `library-node`, `delete`, `baseline`), actor, time, the Flow's name, the snapshot (name, placements with the library Node definition inlined, edges) and the summary as a typed list of changes.
- **Written with the change**: in the transaction of the writer, after it holds the Flow row lock, so versions are numbered without gaps and a failed or refused change leaves none. A save that changes nothing records nothing. Editing a library Node adds a `library-node` version to each Flow that uses it, in one transaction with the edit.
- **Summary in plain words**: `diffFlow` and `describeChange` in `packages/core` turn two snapshots into sentences such as `Node "Implement" added`. A move alone is "Layout changed".
- **Secrets**: known token patterns are masked in every instructions, command and extra instructions field before storage and again on display (NFR-1). A restore from a masked version therefore writes the mask, not the secret.
- **Compatibility**: only a table is added and only the web app reads or writes it, so Web and Gateway can restart separately. Existing audit entries are unchanged; `flow.*` entries gain `versionId` in their detail. The migration adds one `baseline` version ("existing before history") per existing Flow.
- **Restore and clone**: restore rewrites the Flow from a snapshot under the same row lock and Active Run check as a save (FLW-7), and is stored even with problems (FLW-5). A library Node that no longer exists is made again from the stored definition; one that still exists keeps its current definition. Cloning a version creates a new Flow.

## Considered Options

- **Diffs only**: smaller, but restoring means replaying every earlier change and one bad row breaks all later versions. A Flow is small, so a snapshot per change is cheap.
- **Only the audit log**: has no graph to show or restore, and one global list is hard to read for one Flow.
- **Keep versions for a limited time**: saves space, but a deleted Flow could no longer be looked up. Revisit if the table grows.
- **Link each version to the Runs that used it**: Runs already keep `flowSnapshot`; left for later.
