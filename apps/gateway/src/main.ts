import { systemClock } from "@clauderon/core";
import { connect, listenGatewayCommands, listenMemberRevoked, parseOperatorEmails } from "@clauderon/db";
import { createGateway } from "./gateway";
import { createGatewayServer } from "./server";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const databaseUrl = required("DATABASE_URL");
const { db } = connect(databaseUrl);
const sessionSecret = required("SESSION_SECRET");

const gateway = createGateway({
  db,
  clock: systemClock,
  operators: parseOperatorEmails(process.env.OPERATOR_EMAILS),
  sessionSecret,
  // GitHub tokens are masked by their pattern; the app's own lives encrypted in the database (ADR 0010).
  appSecrets: [sessionSecret],
});

// The boot wait (spec M3 §6): Run state is in the database; each Machine with Running Runs has 30 s to say hello.
await gateway.start();
await gateway.retention.start();
await listenMemberRevoked(databaseUrl, (email) => gateway.hub.revoke(email));
await listenGatewayCommands(databaseUrl, (command) => {
  gateway.machines.command(command).catch((error: unknown) => console.warn(`gateway command ${command.type} failed: ${String(error)}`));
});

const port = Number(process.env.GATEWAY_PORT ?? 4000);
// The web app's URL, so a pairing Agent can open the page that approves its code.
const webUrl = process.env.WEB_URL ?? process.env.AUTH_URL;
createGatewayServer({ db, clock: systemClock, links: gateway.links, hub: gateway.hub, webUrl }).listen(port, () => console.log(`gateway listening on ${port}`));
