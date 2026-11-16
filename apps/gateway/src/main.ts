import { systemClock } from "@clauderon/core";
import { connect, listenMemberRevoked, parseOperatorEmails } from "@clauderon/db";
import { BrowserHub } from "./browser-hub";
import { HostLink } from "./host-link";
import { createGatewayServer } from "./server";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const databaseUrl = required("DATABASE_URL");
const { db } = connect(databaseUrl);

const link = new HostLink({
  db,
  secret: required("HOST_AGENT_SECRET"),
  podImage: process.env.POD_IMAGE ?? "",
  clock: systemClock,
});
const hub = new BrowserHub({
  db,
  operators: parseOperatorEmails(process.env.OPERATOR_EMAILS),
  sessionSecret: required("SESSION_SECRET"),
  clock: systemClock,
});

await link.start();
await listenMemberRevoked(databaseUrl, (email) => hub.revoke(email));

const port = Number(process.env.GATEWAY_PORT ?? 4000);
createGatewayServer(link, hub).listen(port, () => console.log(`gateway listening on ${port}`));
