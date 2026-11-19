import { buildFlowSnapshot, hashToken, schema, seedSamples, startBatch, type Db } from "@clauderon/db";
import { eq } from "drizzle-orm";

// Rows for app tests, written straight to the real test database.

export async function memberRow(db: Db, email: string, name: string | null = null) {
  const [row] = await db.insert(schema.member).values({ email, name }).returning();
  return row!;
}

/** A paired, connected Machine with both logins; `token` is what its Agent connects with. */
export async function machineRow(db: Db, memberId: string, values: Partial<typeof schema.machine.$inferInsert> & { token?: string } = {}) {
  const { token = `token-${memberId}`, ...rest } = values;
  const [row] = await db
    .insert(schema.machine)
    .values({
      memberId,
      tokenHash: hashToken(token),
      pairedAt: new Date("2026-11-16T09:00:00Z"),
      connected: true,
      slots: 2,
      claudeLoggedIn: true,
      ghLoggedIn: true,
      ...rest,
    })
    .returning();
  return row!;
}

export async function projectRow(db: Db, owner = "acme", repo = "web", baseBranch = "main") {
  const [row] = await db.insert(schema.project).values({ owner, repo, baseBranch, enabledByEmail: "seed@test" }).returning();
  return row!;
}

export async function ticketRow(db: Db, projectId: string, number: number, values: Partial<typeof schema.ticket.$inferInsert> = {}) {
  const [row] = await db
    .insert(schema.ticket)
    .values({
      projectId,
      number,
      title: `Ticket ${number}`,
      body: "",
      labels: [],
      authorLogin: "octocat",
      authorAssociation: "MEMBER",
      issueState: "open",
      url: `https://github.com/acme/web/issues/${number}`,
      syncedAt: new Date("2026-11-16T09:00:00Z"),
      ...values,
    })
    .returning();
  return row!;
}

/** Seeds the sample library and returns the id of a sample Flow by slug. */
export async function sampleFlowId(db: Db, slug = "basic-ticket-delivery"): Promise<string> {
  await seedSamples(db);
  const [row] = await db.select({ id: schema.flow.id }).from(schema.flow).where(eq(schema.flow.slug, slug));
  return row!.id;
}

/** Starts a Real Batch of the sample Flow for some Tickets, as the Start dialog does. */
export async function startSampleBatch(
  db: Db,
  starter: { id: string; email: string },
  machineId: string,
  ticketIds: string[],
  now: Date,
  extraInstructions = "",
  mode: "real" | "dry" = "real",
  slug = "basic-ticket-delivery",
) {
  const flowId = await sampleFlowId(db, slug);
  const flowSnapshot = (await buildFlowSnapshot(db, flowId))!;
  return startBatch(db, { flowId, flowSnapshot, starter, machineId, mode, extraInstructions, ticketIds }, now);
}
