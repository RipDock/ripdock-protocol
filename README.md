# RipDock Protocol

RipDock Protocol v1 defines JSON messages, lifecycle rules, and transport behavior for Apps, Runtimes, Agents, Sessions, Pairing, and Devices.

The defining protocol sources are:

- [SPEC.md](./SPEC.md): normative human-readable protocol definition.
- [THREAT_MODEL.md](./THREAT_MODEL.md): security claims, non-goals, trust boundaries, and required controls.
- [schemas/](./schemas): normative JSON Schema contract surface.

Everything else in this repository is tooling or contributor guidance. Implementations treat `SPEC.md` and `schemas/` as the source of truth.

Reference implementations live in separate implementation repositories.

Public project guidance:

- [CONTRIBUTING.md](./CONTRIBUTING.md): contribution workflow and protocol change rules.
- [VERSIONING.md](./VERSIONING.md): compatibility and breaking-change policy.
- [SECURITY.md](./SECURITY.md): private vulnerability reporting.
- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md): community behavior expectations.

## Scope

The protocol defines:

- WebSocket transport rules
- Pairing, trust, and Session lifecycle
- Runtime/App message events
- Runtime metadata and identity models
- App/Runtime interface events
- Streaming, heartbeat, reconnect, transfer, artifact, and error behavior

The protocol does not define inference, orchestration, memory, vector stores, model routing, Runtime internals, tool execution internals, product setup, deployment, or attachment storage services.

## Implementation Checklist

Conforming implementations should:

- validate Runtime identity by `runtime_id`, Runtime public key, and Runtime public key fingerprint
- reject insecure `http://` and `ws://` Runtime URLs
- complete Pairing before chat
- use `POST /ripdock/pairing/status` for Pairing status checks
- send signed `session.resume` before privileged App messages
- send Agent-routed `message.create` with `runtime_id` and `agent_id`
- reject unknown events and unknown fields unless the current schemas allow them
- keep Session IDs, Pairing material, signatures, nonces, transfer URLs, and private keys out of logs and non-secret storage

## Validation

Run protocol validation with:

```sh
make test
```

The Makefile parses JSON Schema files, compiles schemas with AJV, validates
event and HTTP fixtures, checks that every event in the event union has a valid
fixture, checks public route documentation drift, and checks protocol
terminology.

## License

Apache-2.0
