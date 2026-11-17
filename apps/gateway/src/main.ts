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
const hostAgentSecret = required("HOST_AGENT_SECRET");
const sessionSecret = required("SESSION_SECRET");

const gateway = createGateway({
  db,
  clock: systemClock,
  hostAgentSecret,
  podImage: process.env.POD_IMAGE ?? "",
  operators: parseOperatorEmails(process.env.OPERATOR_EMAILS),
  sessionSecret,
  appSecrets: [hostAgentSecret, sessionSecret, process.env.GITHUB_TOKEN ?? ""].filter(Boolean),
});

await gateway.link.start();
await listenMemberRevoked(databaseUrl, (email) => gateway.hub.revoke(email));
await listenGatewayCommands(databaseUrl, (command) => {
  gateway.pods.command(command).catch((error: unknown) => console.warn(`gateway command ${command.type} failed: ${String(error)}`));
});

const port = Number(process.env.GATEWAY_PORT ?? 4000);
createGatewayServer(gateway.link, gateway.hub, gateway.terminals).listen(port, () => console.log(`gateway listening on ${port}`));
