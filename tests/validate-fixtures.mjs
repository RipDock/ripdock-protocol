import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";

const schemasDir = "schemas";
const schemaFiles = readdirSync(schemasDir)
  .filter((name) => name.endsWith(".schema.json"))
  .map((name) => join(schemasDir, name))
  .sort();

const groups = [
  {
    schema: "schemas/event.schema.json",
    valid: "tests/fixtures/events/valid",
    invalid: "tests/fixtures/events/invalid",
  },
  {
    schema: "schemas/runtime-identity-model.schema.json",
    valid: "tests/fixtures/http/runtime-identity/valid",
    invalid: "tests/fixtures/http/runtime-identity/invalid",
  },
  {
    schema: "schemas/runtime-metadata-response.schema.json",
    valid: "tests/fixtures/http/runtime-metadata/valid",
    invalid: "tests/fixtures/http/runtime-metadata/invalid",
  },
  {
    schema: "schemas/device-identity-model.schema.json",
    valid: "tests/fixtures/http/device-identity/valid",
    invalid: "tests/fixtures/http/device-identity/invalid",
  },
  {
    schema: "schemas/pairing-result.schema.json",
    valid: "tests/fixtures/http/pairing-result/valid",
    invalid: "tests/fixtures/http/pairing-result/invalid",
  },
];

function listJsonFiles(dir) {
  try {
    return readdirSync(dir)
      .filter((name) => name.endsWith(".json"))
      .map((name) => join(dir, name))
      .filter((path) => statSync(path).isFile())
      .sort();
  } catch (error) {
    if (error && error.code === "ENOENT") {
      throw new Error(`Fixture directory is missing: ${dir}`);
    }
    throw error;
  }
}

function refsFor(schema) {
  const schemaBase = basename(schema);
  return schemaFiles
    .filter((candidate) => basename(candidate) !== schemaBase)
    .flatMap((candidate) => ["-r", candidate]);
}

function validateFixture(schema, fixture) {
  execFileSync(
    "npx",
    [
      "--yes",
      "ajv-cli@5.0.0",
      "validate",
      "--spec=draft2020",
      "--strict=false",
      "-s",
      schema,
      ...refsFor(schema),
      "-d",
      fixture,
    ],
    { stdio: "pipe" },
  );
}

function validateGroup(group) {
  for (const fixture of listJsonFiles(group.valid)) {
    validateFixture(group.schema, fixture);
    console.log(`${fixture} valid`);
  }

  for (const fixture of listJsonFiles(group.invalid)) {
    let failed = false;
    try {
      validateFixture(group.schema, fixture);
    } catch {
      failed = true;
    }
    if (!failed) {
      throw new Error(`${fixture} unexpectedly passed ${group.schema}`);
    }
    console.log(`${fixture} invalid`);
  }
}

function schemaJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function refToSchemaPath(ref) {
  return join(schemasDir, ref.replace(/^\.\//, ""));
}

function requiredEventSchemaPaths() {
  const main = schemaJson("schemas/main-event.schema.json").oneOf.map((entry) => refToSchemaPath(entry.$ref));
  const transfer = schemaJson("schemas/transfer-event.schema.json").oneOf.map((entry) => refToSchemaPath(entry.$ref));
  return [...new Set([...main, ...transfer])].sort();
}

function eventTypeForSchema(schemaPath) {
  return schemaJson(schemaPath).properties?.type?.const;
}

function checkEventCoverage() {
  const validFixtures = listJsonFiles("tests/fixtures/events/valid");
  const fixtureTypes = new Map();
  const duplicateTypes = [];
  for (const fixture of validFixtures) {
    const type = JSON.parse(readFileSync(fixture, "utf8")).type;
    if (type) {
      if (fixtureTypes.has(type)) {
        duplicateTypes.push(`${type} (${fixtureTypes.get(type)}, ${fixture})`);
      }
      fixtureTypes.set(type, fixture);
    }
  }
  if (duplicateTypes.length > 0) {
    throw new Error(`Duplicate valid event fixture types:\n${duplicateTypes.join("\n")}`);
  }

  const requiredTypes = new Map(
    requiredEventSchemaPaths().map((schemaPath) => [eventTypeForSchema(schemaPath), schemaPath]),
  );

  const missing = [];
  for (const [type, schemaPath] of requiredTypes.entries()) {
    if (!type || !fixtureTypes.has(type)) {
      missing.push(`${type || "<missing type const>"} (${schemaPath})`);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing valid event fixtures:\n${missing.join("\n")}`);
  }

  const extra = [];
  for (const [type, fixture] of fixtureTypes.entries()) {
    if (!requiredTypes.has(type)) {
      extra.push(`${type} (${fixture})`);
    }
  }
  if (extra.length > 0) {
    throw new Error(`Valid event fixtures outside event union:\n${extra.join("\n")}`);
  }
  console.log("PASS event-fixture-coverage");
}

try {
  for (const group of groups) {
    validateGroup(group);
  }
  checkEventCoverage();
  console.log("PASS schema-fixture-check");
} catch (error) {
  console.error(`FAIL schema-fixture-check: ${error.message}`);
  process.exit(1);
}
