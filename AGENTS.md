# AGENTS.md

## Purpose

This repository defines RipDock Protocol v1.

Normative protocol artifacts:

- `SPEC.md`
- `schemas/`

`README.md` explains repository scope. `Makefile` contains protocol validation tooling.

## Public Scope

This repository defines the normative RipDock Protocol v1 contract.
Contributions must preserve the strict v1 contract unless a breaking protocol
change is explicitly proposed and accepted.

Reference implementations belong in separate implementation repositories, not
in this protocol repository.

## Terminology

Use only these protocol role names:

- App
- Runtime
- Agent
- Connector
- Session
- Pairing
- Device

Do not introduce implementation-specific role names in protocol text.

## Rules

- Protocol v1 strictness is the core contract of this repo. Every field, enum,
  route, event type, security primitive, ordering rule, and error code must be
  defined normatively in `SPEC.md` and enforced by `schemas/` where JSON schema
  applies.
- Preserve current Protocol v1 strictness unless a breaking change is explicitly requested.
- Do not invent protocol behavior outside `SPEC.md`.
- Preserve flat-envelope v1 compatibility.
- `message.create` requires `runtime_id` and `agent_id`.
- Unknown events, unknown fields, alternate wire shapes, implied defaults, and
  compatibility behavior are invalid unless `SPEC.md` and `schemas/` explicitly
  define them.
- Do not document recommendations where the protocol needs requirements. Use
  strict MUST/MUST NOT language for normative behavior.
- If Runtime/App implementation requires behavior not currently specified,
  update `SPEC.md` and schemas first, then make implementations conform.
- Runtime, App, and fixtures must not define their own protocol dialects.
- Keep implementation, product, and development-harness guidance out of
  normative protocol files. Deployment examples must be clearly marked
  non-normative.

## Validation

If modifying `SPEC.md`, `schemas/`, `README.md`, `Makefile`, or `AGENTS.md`,
run:

```sh
make test
```

Fix broken references or schema issues before merging.
