import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const protocolSurfaceFiles = [
  "README.md",
  "SPEC.md",
  "AGENTS.md",
  ...readdirSync("schemas")
    .filter((name) => name.endsWith(".schema.json"))
    .map((name) => join("schemas", name)),
];

const publicRouteDocs = [
  "README.md",
  "SPEC.md",
  ...readdirSync("examples/cloudflare")
    .filter((name) => name.endsWith(".md"))
    .map((name) => join("examples/cloudflare", name)),
];

function fileText(path) {
  return readFileSync(path, "utf8");
}

function lineNumberFor(text, index) {
  return text.slice(0, index).split("\n").length;
}

function findMatches(files, pattern) {
  const matches = [];
  for (const file of files) {
    const text = fileText(file);
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      matches.push(`${file}:${lineNumberFor(text, match.index)}:${match[0]}`);
    }
  }
  return matches;
}

function failIfMatches(label, files, pattern, message) {
  const matches = findMatches(files, pattern);
  if (matches.length === 0) {
    return;
  }
  throw new Error(`${label}: ${message}\n${matches.join("\n")}`);
}

function assertContains(path, needle, message) {
  if (!fileText(path).includes(needle)) {
    throw new Error(`${path}: ${message}`);
  }
}

try {
  failIfMatches(
    "public-route-policy",
    publicRouteDocs,
    /\/ripdock\/admin\b/g,
    "public protocol and deployment docs must not expose local Runtime admin routes",
  );

  failIfMatches(
    "pairing-status-route-policy",
    publicRouteDocs,
    /`?GET\s+\/ripdock\/pairing\/status`?/g,
    "Pairing status is a POST route in public protocol docs",
  );

  for (const file of ["README.md", "SPEC.md", "examples/cloudflare/README.md"]) {
    assertContains(
      file,
      "POST /ripdock/pairing/status",
      "Pairing status route must be documented as POST",
    );
  }

  failIfMatches(
    "terminology-policy",
    protocolSurfaceFiles,
    /\b(adapter|backend bridge|backend|dev harness)\b/g,
    "protocol surface must use App, Runtime, Agent, Connector, Session, Pairing, and Device terminology",
  );

  console.log("PASS protocol-policy-check");
} catch (error) {
  console.error(`FAIL protocol-policy-check: ${error.message}`);
  process.exit(1);
}
