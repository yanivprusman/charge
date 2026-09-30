#!/usr/bin/env node
/**
 * Print a link that signs a browser in to the web version of גבייה.
 *
 *   node scripts/make-link.mjs                       # this machine, 10 minutes
 *   node scripts/make-link.mjs 60                    # valid for an hour
 *   node scripts/make-link.mjs 10 http://10.7.0.2:3139   # for another device on the VPN
 *
 * The other way in is to paste CHARGE_API_TOKEN into the sign-in form; this is
 * for a device where copying a secret across is the awkward part. The link
 * carries a signature over its own expiry and nothing else — not the token —
 * so it is safe to send to yourself, and worthless once the minutes are up.
 */
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envFile = path.join(appDir, ".env.local");

function fail(message) {
  console.error(`make-link: ${message}`);
  process.exit(1);
}

function readToken() {
  let text;
  try {
    text = readFileSync(envFile, "utf8");
  } catch (e) {
    fail(`cannot read ${envFile} (${e.code ?? e.message})`);
  }
  const line = text.split("\n").find((l) => l.startsWith("CHARGE_API_TOKEN="));
  const token = (line ?? "").slice("CHARGE_API_TOKEN=".length).trim().replace(/^["']|["']$/g, "");
  if (!token) fail(`CHARGE_API_TOKEN is not set in ${envFile}`);
  return token;
}

/** The daemon owns the port; the dev server is wherever it says. */
function devPort() {
  const socketPath =
    process.env.AUTOMATE_LINUX_SOCKET_PATH || "/run/automatelinux/automatelinux-daemon.sock";
  return new Promise((resolve) => {
    let reply = "";
    const client = net.createConnection(socketPath);
    client.setTimeout(5000, () => client.destroy(new Error("timeout")));
    client.on("connect", () =>
      client.write(JSON.stringify({ command: "getPort", key: "charge-dev" }) + "\n"),
    );
    client.on("data", (d) => {
      reply += d.toString();
      if (reply.endsWith("\n")) client.end();
    });
    client.on("error", (e) => fail(`cannot ask the daemon for the charge-dev port (${e.message})`));
    client.on("close", () => {
      const port = reply.trim();
      if (!/^\d+$/.test(port)) fail(`the daemon has no port for charge-dev (it said: ${port || "nothing"})`);
      resolve(port);
    });
  });
}

const minutes = process.argv[2] === undefined ? 10 : Number(process.argv[2]);
if (!Number.isFinite(minutes) || minutes <= 0) fail(`minutes must be a positive number, got "${process.argv[2]}"`);

const token = readToken();
const origin = (process.argv[3] ?? `http://localhost:${await devPort()}`).replace(/\/+$/, "");
const exp = Math.floor(Date.now() / 1000 + minutes * 60);
const sig = createHmac("sha256", token).update(`charge-web-link-v1:${exp}`).digest("hex");

console.log(`${origin}/api/session/link?exp=${exp}&sig=${sig}`);
