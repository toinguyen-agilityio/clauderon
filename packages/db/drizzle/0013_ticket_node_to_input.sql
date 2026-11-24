-- Every Ticket Node becomes an Input Node of type issue. Run snapshots keep kind `ticket`; the engine reads both.
UPDATE "node" SET "kind" = 'input' WHERE "kind" = 'ticket';--> statement-breakpoint
-- Code a change may start from a plan alone. A sample a Member has edited keeps their inputs.
UPDATE "node"
SET
  "inputs" = '[{"name":"issue","type":"issue","required":false,"group":"context"},{"name":"plan","type":"plan","required":false,"group":"context"}]'::jsonb,
  "instructions" = replace("instructions", 'Make the change the issue asks for,', 'Make the change the issue or the plan asks for,')
WHERE "slug" = 'code-a-change'
  AND "inputs" = '[{"name":"issue","type":"issue","required":true},{"name":"plan","type":"plan","required":false}]'::jsonb;
