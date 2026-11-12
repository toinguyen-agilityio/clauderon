# Flows are typed DAGs without cycles, run one Node at a time

A Flow is a directed acyclic graph drawn on a canvas, and an edge is allowed only when the Output Type matches the next Node's input. Cycles are forbidden, so there is no automatic "tests failed, go back to coding": a failed or rejected Node fails the Run, and a Member retries from whichever Node they choose, with the rejection feedback passed along. Although the graph can branch, a Run executes its Nodes one at a time in topological order, because all Nodes of a Run share one git worktree and two agents editing it at once would collide.

## Considered Options

- **Linear list of Steps with Loop-backs** (the team draft): models fix-test-review loops directly, but gives up the typed canvas and its validation.
- **Parallel branches with one worktree per branch**: real parallelism, but needs merging worktrees where branches meet.

## Consequences

- Fix-and-retest loops need a person to press Retry.
- Branches in a Flow express data dependencies, not speed.
