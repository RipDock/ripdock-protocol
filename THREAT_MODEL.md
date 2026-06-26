# RipDock Protocol Threat Model

This document defines the current security claims and non-goals for RipDock
Protocol v1. The protocol model is App-to-Runtime direct communication over
HTTPS/WSS, including connections reached through tunnels.

## Security Goals

- The App must authenticate the Runtime by persistent Runtime identity, not by
  hostname alone.
- The Runtime must authenticate the App Device by Pairing trust and signed
  `session.resume`.
- A stolen `session_id` alone must not be sufficient to resume an App Session.
- Pairing must bind a Device public key to Runtime trust before chat is allowed.
- Revoked, rejected, expired, disabled, unknown, or identity-mismatched Devices
  must not be able to resume or silently re-Pair.
- Replay of a captured signed resume frame must fail.
- Logs and non-secret storage must not expose Session IDs, private keys, tokens,
  signatures, nonces, or transfer credentials.
- Tunnel throttling, drops, and reconnects must not weaken endpoint identity or
  proof-of-possession requirements.

## Non-Goals

- The protocol does not hide plaintext message content from the Runtime.
- The protocol does not protect a Device after the Device private key and local
  secret store are both compromised.
- The protocol does not define model sandboxing, tool sandboxing, memory policy,
  or Runtime internals.
- The protocol does not define cloud object storage, multi-tenant authorization,
  or enterprise identity provider integration in v1.
- The protocol does not treat a tunnel provider as a trusted protocol actor.

## Trust Boundaries

- App: owns local UI, Device private key, Session secret storage, local message
  state, and user intent.
- Device: holds the App Device identity and private key. Compromise of this
  boundary can authorize the attacker until Runtime policy revokes the Device.
- Runtime: owns Runtime identity, Device trust state, Session binding, Agent
  behavior, and generated artifacts.
- Tunnel: transports traffic between App and Runtime. It may throttle, drop,
  delay, or disconnect traffic, but it must not be trusted for App or Runtime
  identity.
- Local storage/logs: considered leak-prone unless explicitly secret storage.

## Direct And Tunneled Connection Security

Runtime URLs, Tunnel URLs, hostnames, certificate subjects, and URL strings are
connection locations only. They are not trusted Runtime identity.

Required behavior:

- App MUST use `https://` for Runtime base URLs and `wss://` for Runtime
  WebSocket routes.
- App MUST reject `http://` and `ws://` before identity fetch, Pairing, or
  Session resume.
- App MUST authenticate the Runtime by persistent Runtime identity:
  `runtime_id`, Runtime public key, and Runtime public key fingerprint.
- App MAY follow a changed Runtime URL or Tunnel URL only when the Runtime
  presents the same trusted Runtime identity.
- App MUST fail closed on unexpected Runtime ID, public key, or fingerprint
  changes until explicit user or admin action restores trust.
- Stale, unreachable, expired, throttled, or rotated Tunnel URLs are connection
  conditions. They MUST NOT grant trust, revoke trust by themselves, allow
  insecure fallback, or skip endpoint identity checks.
- Runtime MUST authenticate the paired Device with signed `session.resume`
  before accepting privileged App messages.
- Runtime MUST reject stale timestamps, reused nonces, wrong route context,
  invalid signatures, unknown Devices, revoked Devices, expired Devices,
  disabled Devices, and Sessions not bound to the presented Device and Runtime.
- Tunnel behavior MUST NOT weaken Runtime identity validation, Device signature
  verification, replay checks, Session lifecycle policy, Pairing rules,
  authorization scope checks, or sensitive log redaction.

## Threats And Required Behavior

### Stolen Session ID

An attacker with only `session_id` must not resume. Runtime must require a valid
Device signature over the canonical resume material, including `session_id`,
`runtime_id`, `app_device_id`, nonce, timestamp, key ID, and route.

### Replay

Runtime must reject stale resume timestamps and reused nonces. Invalid
signatures must not consume nonce replay state.

### Wrong Device Key

Runtime must verify the resume signature with the public key stored for the
paired Device. Wrong key ID, missing public key, or mismatched Device identity
must fail closed.

### Runtime Identity Change

The App must treat unexpected Runtime ID, public key, or fingerprint changes as
a security event requiring explicit user or admin action before trust resumes.

### Revoked Or Rejected Device

Runtime must reject resume and Pairing refresh/request attempts for revoked
Devices. Rejected Devices must not silently re-enter Pairing while the rejection
record remains active.

### Pairing Abuse

Pairing codes and invites must expire. Protocol v1 does not define deployment
rate-limit thresholds, edge provider rules, IP reputation policy, bot
mitigation, or tunnel abuse controls. Operators exposing a Runtime directly or
through a tunnel are responsible for deployment-level abuse protection.

Runtime and App endpoint security checks remain protocol responsibilities:
identity validation, signed resume verification, nonce replay rejection, stale
timestamp rejection, Device revocation, authorization, message size limits, and
generic failures that do not reveal whether a Session, Device, key, nonce, or
Pairing code exists.

### Rate-Limited Tunnels

The App and Runtime must tolerate slow or throttled tunnels. Required behavior:
bounded reconnect backoff, idempotent resume attempts, no duplicate trust grants,
no weakening of signature/replay checks, and user-facing errors that describe
the connection problem without exposing transport internals.

### Local Device Compromise

If an attacker can use the Device private key and Session secrets, the attacker
may resume until Runtime revokes the Device or Session expires. Implementations
MUST use non-exportable hardware-backed keys when available.

### Log Or Storage Leakage

Session IDs, Pairing tokens, invite tokens, private keys, signatures, nonces,
authorization material, and transfer credentials must be redacted from logs and
kept out of non-secret storage.

## Current Controls

- Signed `session.resume` using P-256 / ES256 proof-of-possession.
- Resume timestamp and nonce replay checks.
- Invalid signatures do not burn nonce replay state.
- Device public keys required for trusted resume.
- Revoked Devices are rejected and existing App sockets are closed.
- Session resume enforces idle timeout and absolute lifetime.
- Endpoint policy requires Session ID rotation on successful signed resume.
- Revoking a Device invalidates the current Session bound to that Device.
- Trusted Devices have explicit authorization scopes, and privileged App
  messages are rejected when the resumed Device lacks the required scope.
- Pairing requests create expiring pending Device records.
- Revoked and recently rejected Devices cannot silently re-Pair.
- Session IDs and signed resume fields are redacted from protocol logs.

## Remaining Work

- Add channel binding when platform support is practical.
- Extend authorization scopes with per-Agent and per-resource policies.
- Expand fuzzing and negative tests for decoders and malformed protocol frames.
- Add external security review before public high-security claims.
