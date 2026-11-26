CREATE TABLE "flow_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"flow_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"kind" text NOT NULL,
	"actor_email" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"flow_name" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"summary" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "flow_version_flow_seq_idx" ON "flow_version" USING btree ("flow_id","seq");--> statement-breakpoint
CREATE INDEX "flow_version_kind_at_idx" ON "flow_version" USING btree ("kind","at");--> statement-breakpoint
-- Backfill: one first version ("existing before history") per Flow that exists now. Tokens are masked as in packages/core/src/mask.ts (NFR-1).
CREATE OR REPLACE FUNCTION pg_temp.flow_history_mask(t text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(t, '\mgh[pousr]_[A-Za-z0-9]{20,}\M', '•••', 'g'),
        '\mgithub_pat_[A-Za-z0-9_]{20,}', '•••', 'g'),
      '\msk-ant-[A-Za-z0-9_-]{8,}', '•••', 'g'),
    '\m(Bearer\s+)[^\s"'']+', '\1•••', 'gi')
$$;
--> statement-breakpoint
INSERT INTO "flow_version" ("flow_id", "seq", "kind", "actor_email", "at", "flow_name", "snapshot", "summary", "detail")
SELECT
  f."id", 1, 'baseline', f."updated_by_email", f."updated_at", f."name",
  jsonb_build_object(
    'name', f."name",
    'nodes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', fn."id",
        'nodeId', fn."node_id",
        'label', fn."label",
        'definition', jsonb_build_object(
          'name', n."name",
          'kind', n."kind",
          'instructions', pg_temp.flow_history_mask(n."instructions"),
          'command', CASE WHEN n."command" IS NULL THEN NULL ELSE to_jsonb(pg_temp.flow_history_mask(n."command")) END,
          'inputs', n."inputs",
          'outputs', n."outputs"),
        'extraInstructions', pg_temp.flow_history_mask(fn."extra_instructions"),
        'enabledOptionalOutputs', fn."enabled_optional_outputs",
        'x', fn."x",
        'y', fn."y") ORDER BY fn."created_at", fn."id")
      FROM "flow_node" fn JOIN "node" n ON n."id" = fn."node_id"
      WHERE fn."flow_id" = f."id"), '[]'::jsonb),
    'edges', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', e."id",
        'fromFlowNodeId', e."from_flow_node_id",
        'fromOutput', e."from_output",
        'toFlowNodeId', e."to_flow_node_id",
        'toInput', e."to_input") ORDER BY e."created_at", e."id")
      FROM "flow_edge" e WHERE e."flow_id" = f."id"), '[]'::jsonb)),
  '[{"type":"baseline"}]'::jsonb,
  '{}'::jsonb
FROM "flow" f;

--> statement-breakpoint
DROP FUNCTION pg_temp.flow_history_mask(text);
