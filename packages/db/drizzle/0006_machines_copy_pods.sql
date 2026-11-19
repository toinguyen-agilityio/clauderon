-- ADR 0006: every Pod becomes its Member's Machine, unpaired, with the same id,
-- so Runs keep their place. Running Runs end as Interrupted (big-bang cutover):
-- their Pod is gone; a Retry runs them on the Member's Machine once paired.
INSERT INTO "machine" ("id", "created_at", "member_id", "name", "slots", "claude_logged_in", "gh_logged_in", "gh_account", "gh_token_scope", "logins_checked_at")
SELECT "id", "created_at", "member_id", "name", "slots", false, false, "gh_account", "gh_token_scope", NULL FROM "pod";
--> statement-breakpoint
UPDATE "run" SET "machine_id" = "pod_id" WHERE "pod_id" IS NOT NULL;
--> statement-breakpoint
UPDATE "attempt" SET "state" = 'interrupted', "ended_at" = now(), "error" = 'Moved to personal Machines'
WHERE "state" = 'running' AND "run_id" IN (SELECT "id" FROM "run" WHERE "state" = 'running');
--> statement-breakpoint
UPDATE "run" SET "state" = 'interrupted', "ended_at" = now(), "failure_reason" = 'Moved to personal Machines' WHERE "state" = 'running';
