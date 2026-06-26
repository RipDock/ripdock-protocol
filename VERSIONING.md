# Versioning And Compatibility

RipDock Protocol uses an explicit protocol major version on wire messages.
Protocol v1 uses:

```json
{
  "protocol_version": "1"
}
```

## Source Of Truth

The normative Protocol v1 contract is defined by:

- `SPEC.md`
- `schemas/`

If documentation, examples, fixtures, or implementations disagree with
`SPEC.md` and `schemas/`, the spec and schemas win.

## Strict V1 Compatibility

Protocol v1 is strict.

- Unknown event types are invalid.
- Unknown fields are invalid unless the event or body schema explicitly allows
  them.
- Alternate wire shapes are invalid unless explicitly defined.
- Implementations must not infer defaults for absent required fields.
- Compatibility shims are not part of v1 unless defined by `SPEC.md` and
  enforced by schemas where JSON Schema applies.
- App-to-Runtime chat is Agent-routed. `message.create` requires `runtime_id`
  and `agent_id`.
- Pairing status uses `POST /ripdock/pairing/status`; v1 does not define a
  query-string status route.

## Non-Breaking Changes

A change is usually non-breaking when it does not require existing conforming
Apps or Runtimes to change their accepted v1 behavior.

Examples:

- clarifying normative text without changing behavior
- adding examples that match existing schemas
- adding tests or fixtures for existing behavior
- tightening non-normative deployment guidance to match `SPEC.md`
- fixing schema descriptions without changing validation behavior

Adding optional fields may still be breaking in practice because v1 rejects
unknown fields unless schemas define them. Optional field additions must update
both `SPEC.md` and schemas, and should include fixture coverage.

## Breaking Changes

A change is breaking when it changes the v1 wire contract or required behavior
for conforming implementations.

Examples:

- adding a required field
- removing a field, route, event, enum value, authorization scope, or error code
- changing field type, meaning, or validation rules
- accepting previously invalid event shapes
- changing Session, Pairing, Runtime identity, replay, or authorization rules
- changing route methods or request/response body schemas
- changing `protocol_version` semantics

Breaking changes require an explicit proposal and must identify affected Apps,
Runtimes, Agents, Sessions, Pairing flows, Devices, fixtures, and schemas.

## Major Versions

A new protocol major version is required when a breaking change should coexist
with existing v1 implementations.

Major-version work must define:

- the new `protocol_version` value
- migration expectations
- whether v1 and the new version can be served by the same Runtime
- how Apps discover supported protocol versions
- schema entry points for the new version
- security and threat-model changes

## Deprecation

Deprecation does not make invalid behavior valid.

If a v1 feature remains in `SPEC.md` and schemas, conforming implementations
must continue to treat it according to the v1 contract. Removing or changing it
is a breaking change.

If a feature is implementation-specific and not part of Protocol v1, it should
not be documented as protocol behavior.

## Release Checklist

Before publishing a protocol release:

1. Run `make test`.
2. Confirm `SPEC.md` and schemas agree.
3. Confirm valid and invalid fixtures cover changed behavior.
4. Confirm public examples do not expose admin or development routes.
5. Confirm `THREAT_MODEL.md` is current for security-sensitive changes.
6. Confirm `SECURITY.md` has current reporting instructions.
