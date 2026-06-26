# Contributing To RipDock Protocol

Thank you for helping improve RipDock Protocol.

This repository defines the normative RipDock Protocol v1 contract. Changes
must preserve the strict protocol surface unless a breaking change is explicitly
proposed and accepted.

## Repository Scope

Normative protocol artifacts:

- `SPEC.md`
- `schemas/`

Supporting public artifacts:

- `README.md`
- `THREAT_MODEL.md`
- `SECURITY.md`
- `VERSIONING.md`
- `examples/`
- `tests/fixtures/`
- `Makefile`

Reference implementations, Runtime internals, App internals, product behavior,
deployment automation, and development harness behavior belong in separate
repositories.

## Terminology

Use these protocol role names:

- App
- Runtime
- Agent
- Connector
- Session
- Pairing
- Device

Avoid implementation-specific role names in protocol text.

## Protocol Change Rules

Protocol v1 is strict.

- Every route, event type, field, enum, security primitive, ordering rule, and
  error code must be defined in `SPEC.md`.
- JSON message and HTTP body shapes must be enforced by `schemas/` when JSON
  Schema applies.
- Unknown fields, unknown event types, alternate wire shapes, implied defaults,
  and compatibility behavior are invalid unless the spec and schemas explicitly
  define them.
- Protocol examples and fixtures must use only current v1 shapes.

If an implementation needs behavior not defined here, update the protocol first.
Do not add implementation-only protocol dialects.

## Making A Change

For documentation-only clarifications:

1. Update the relevant Markdown file.
2. Confirm the change does not alter the wire contract.
3. Run `make test`.

For schema or protocol behavior changes:

1. Update `SPEC.md`.
2. Update the relevant schema files.
3. Add or update valid and invalid fixtures under `tests/fixtures/`.
4. Confirm every concrete event schema in the event union has a valid fixture.
5. Run `make test`.

For non-normative examples:

1. Mark examples as non-normative.
2. Keep public routes aligned with `SPEC.md`.
3. Do not expose admin, dashboard, diagnostics, or development routes as App
   protocol routes.
4. Run `make test`.

## Validation

Run:

```sh
make test
```

The validation suite:

- parses all JSON Schema files
- compiles schemas with AJV draft 2020
- validates valid and invalid event fixtures
- validates valid and invalid HTTP body fixtures
- checks that every event in the event union has a valid fixture
- checks public documentation route drift
- checks protocol terminology

Fix validation failures before requesting review.

## Security Issues

Do not open public issues for suspected security vulnerabilities. Follow
`SECURITY.md`.

Security-sensitive protocol changes should update `THREAT_MODEL.md` when they
change trust boundaries, security goals, non-goals, required controls, or
remaining work.

## Breaking Changes

Breaking changes require an explicit proposal. See `VERSIONING.md`.

Examples of breaking changes include:

- adding required fields to existing events
- removing fields, events, routes, enum values, or error codes
- changing field meaning
- changing authorization or trust requirements
- accepting previously invalid wire shapes
- changing `protocol_version` behavior

Do not mix breaking and non-breaking changes in the same proposal unless the
proposal explains why they must land together.
