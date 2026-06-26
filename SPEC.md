# RipDock Protocol v1

## 1. Scope

RipDock Protocol v1 defines the runtime interaction channel between:

- an App,
- and a Runtime reached directly, including through a tunnel URL.

The protocol covers WebSocket routes, Pairing, Session resume, Runtime event streaming, heartbeat behavior, reconnect behavior, Runtime URLs, chunked transfer control, and Device identity.

The protocol does not define inference, memory, tool execution internals, Agent orchestration, model routing, or background task implementation. Those remain Runtime concerns.

## 2. Non-Goals

RipDock Protocol v1 does not define:

- inference semantics,
- prompts,
- memory,
- vector stores,
- Agent orchestration,
- model routing,
- tool schemas,
- tool execution internals,
- cloud object storage semantics,
- arbitrary attachment upload APIs,
- storage semantics,
- platform-specific authentication implementation details,
- resumable file transfers,
- thumbnails or previews.

## 3. V1 Compatibility Baseline

V1 is text-first, WebSocket-based, Agent-routed, and uses append-only streaming for ordinary assistant text. The App connects to a Runtime App Session socket and sends signed `session.resume` before privileged messages. There is no cloud object storage transport. App Session resume requires proof-of-possession using the paired Device private key.

V1 is Agent-first. `conversation.create` and `message.create` require `runtime_id` and `agent_id`; Runtime-only chat requests are invalid. `message.block` is part of the v1 event surface.

## 4. Normative Language

The words `MUST`, `MUST NOT`, `REQUIRED`, `SHALL`, `SHALL NOT`, `MAY`, and `OPTIONAL` are normative in this specification.

- `MUST`, `REQUIRED`, and `SHALL` define mandatory v1 behavior.
- `MUST NOT` and `SHALL NOT` define prohibited v1 behavior.
- `MAY` and `OPTIONAL` define explicitly permitted behavior. Optional behavior is still constrained by all surrounding requirements.
- Lowercase descriptive words do not create implementation choices unless the sentence also uses a normative word.
- This specification does not use non-binding guidance as protocol requirements. Non-normative background text is labeled explicitly as non-normative.

## 5. Terms

- App: native client used on a Device.
- Runtime: the system that receives App messages and streams results.
- Agent: a Runtime-owned chat identity that receives user messages, owns chat display metadata, and scopes local App chat state.
- Session: durable App-to-Runtime conversation/security scope resumed over a WebSocket.
- Pairing: setup flow that lets an App discover or bind a Runtime Session.
- Device: an App installation or client device participating in Pairing or a Session.
- Runtime base URL: an `https://` connection location for Runtime identity discovery, metadata, and other HTTP routes.
- App Session WebSocket route: the `wss://<runtime-host>/ripdock/app` route used to attach a WebSocket to an existing Session after signed `session.resume`.
- Pairing WebSocket route: the `wss://<runtime-host>/ripdock/app/pair/<pairingCode>` route used for Pairing.
- Tunnel URL: a Runtime connection location whose host is provided by tunnel infrastructure. A Tunnel URL is not Runtime identity.

## 6. Transport

The main protocol transport is WebSocket. Each main protocol message is a UTF-8 JSON object.

Binary messages are not allowed on the main protocol socket. Protocol heartbeat uses JSON `ping` and `pong` events.

V1 App-to-Runtime file upload uses a separate transfer WebSocket/channel created by `transfer.ready`. Runtime-to-App generated artifacts are downloaded by the App over HTTPS using an artifact download URL announced by the Runtime. File bytes must not be sent over the main protocol socket.

Endpoints advertise protocol message size policy with `endpoint.policy`. The advertised `max_message_bytes` value is the maximum UTF-8 encoded size of each complete protocol message/event sent or received through that endpoint.

## 7. Envelope

The v1 protocol uses a flat JSON envelope. Events carry event-specific fields exactly as defined by their schemas.

Envelope fields:

- `protocol_version`: protocol major version as a string. Required on every main and transfer WebSocket protocol event. Current value is `"1"`.
- `type`: event name.
- `session_id`: opaque Session ID. Present on Pairing control and resume events, not on every message.
- `runtime_id`: stable Runtime identity. Required on Agent-routed App-to-Runtime chat and Agent settings events.
- `agent_id`: Runtime-scoped Agent identity. Required on Agent-routed App-to-Runtime chat and Agent settings events.
- `conversation_id`: Runtime-owned conversation scope. Required by individual event schemas after the Runtime creates a conversation. Apps MUST NOT synthesize or choose it.
- `message_id`: Runtime-created message scope. Optional only on event schemas that explicitly list it without requiring it.
- `payload`: event-specific object for events whose schemas define a required payload object.

## 8. Protocol Stability Rules

- Unknown fields are invalid unless the event schema explicitly allows them.
- Unknown event types MUST be rejected with `protocol.invalid_payload`. Endpoints MUST keep the connection open after rejecting an unknown event.
- `protocol_version` must be `"1"` on every main and transfer WebSocket protocol event.

## 9. Persistent Identity, Trust, Sessions, And Transport

RipDock separates persistent identity, long-lived trust, recoverable Sessions, and ephemeral WebSocket transport. Identity and Pairing/trust are persistent. Sessions are recoverable according to endpoint policy. WebSocket connections are disposable transport attachments.

Persistent App identity fields:

- `app_device_id`: stable App installation or Device identifier.
- `app_public_key`: App Device P-256 JWK public key object used to verify signed Session resume.
- `app_public_key_fingerprint`: stable fingerprint of the App Device public key. This MUST equal `app_public_key.key_id`.
- `app_display_name`: user-facing App Device display name.

Persistent Runtime identity fields:

- `runtime_id`: stable Runtime identifier.
- `runtime_public_key`: Runtime P-256 JWK public key object used for Runtime identity validation.
- `runtime_public_key_fingerprint`: stable fingerprint of the Runtime public key. This MUST equal `runtime_public_key.key_id`.
- `runtime_identity_created_at`: timestamp when the Runtime identity key was created.

Runtime-owned display metadata fields:

- `displayName`: user-facing Runtime name.
- `icon`: Runtime-owned emoji icon. `null` means no icon. Non-emoji icon names, platform symbol names, image tokens, URLs, and asset identifiers are invalid.
- `accentColor`: Runtime-owned accent color. `null` means no accent color.
- `backgroundColor`: required Runtime-owned background color. The default is `#ffffff`.

Runtime metadata is owned by the Runtime, not by the App. The App consumes these values during Pairing and Runtime state fetches, and may cache them locally for display consistency. The App must not allow user overrides for these fields. RuntimeIdentity and its public key fingerprint remain immutable and separate from Runtime metadata.

Pairing establishes a durable trust relationship and persistent identity association between one App Device and one Runtime. Pairing must not be treated as only a temporary WebSocket Session binding.

Runtime identity is cryptographic identity, not hostname identity. A Runtime URL may change without changing trust when the Runtime presents the same trusted `runtime_id`, `runtime_public_key`, and `runtime_public_key_fingerprint`. A Runtime public key change for an existing trusted `runtime_id` is a security event and must require explicit user or admin action before trust is restored.

Runtime transport must be secure:

- Runtime base URLs must use `https://`.
- Runtime WebSocket connections must use `wss://`.
- `http://` and `ws://` are unsupported for App/Runtime communication.
- HTTPS/WSS provides transport security. RuntimeIdentity provides application-level Runtime identity.
- Runtime trust remains based on the cryptographic RuntimeIdentity fingerprint, not the hostname, certificate common name, or URL string.
- Runtime base URLs are for discovery, admin HTTP routes, public metadata, and other non-chat HTTP resources. Protocol chat transport uses `wss://<runtime-host>/ripdock/app`, followed by `session.resume` as the first App protocol message.
- Pairing QR `runtime_url` is a `wss://` App Pairing WebSocket route, not a Runtime base URL.
- Apps must not connect to bare `wss://<runtime-host>`.
- Apps must not use `runtime_id` or `conversation_id` as `session_id`.

Direct and tunneled connection security:

- A Runtime base URL, App Session WebSocket route, Pairing WebSocket route, Tunnel URL, hostname, certificate subject, and URL string are connection locations only. They MUST NOT be treated as trusted Runtime identity.
- RuntimeIdentity is the application-level Runtime identity. Apps MUST validate the expected `runtime_id`, `runtime_public_key`, and `runtime_public_key_fingerprint` before treating a Runtime connection as trusted.
- Apps MUST reject `http://` Runtime base URLs and `ws://` Runtime WebSocket routes before Runtime identity fetch, Pairing, or Session resume.
- Apps MUST NOT downgrade `https://` Runtime base URLs to `http://`, or `wss://` Runtime WebSocket routes to `ws://`.
- Apps MUST NOT trust a tunnel endpoint because the tunnel provider successfully opened an HTTPS/WSS connection. Tunnel infrastructure is not a protocol actor.
- Apps MAY continue using a changed Runtime base URL or Tunnel URL only when the Runtime presents the same trusted `runtime_id`, `runtime_public_key`, and `runtime_public_key_fingerprint`.
- Apps MUST fail closed when an existing trusted Runtime presents a different `runtime_id`, `runtime_public_key`, or `runtime_public_key_fingerprint`. Implementations MUST treat this as `identityMismatch` or an equivalent fail-closed trust state until explicit user or admin action restores trust.
- A stale, expired, unreachable, or throttled Tunnel URL MUST be treated as a connection failure. It MUST NOT revoke trust by itself, grant trust, skip Runtime identity validation, skip Device signature verification, or permit insecure transport fallback.
- Runtime endpoints MUST verify signed `session.resume` before accepting `conversation.create`, `message.create`, transfer control messages, Agent settings changes, Runtime settings changes, or any other privileged App message.
- Runtime endpoints MUST bind resume verification to the expected `runtime_id`, `app_device_id`, `session_id`, route context, nonce, timestamp, key ID, and paired Device public key.
- Runtime endpoints MUST reject resume on the wrong route context, stale timestamp, reused nonce, invalid signature, unknown Device, revoked Device, expired Device, disabled Device, or Session not bound to the presented Device and Runtime.
- Tunnel reconnects, URL rotation, throttling, dropped connections, delayed frames, and reordered reconnect attempts MUST NOT weaken Runtime identity validation, Device signature verification, replay checks, Session lifecycle policy, Pairing rules, authorization scope checks, or log redaction.
- Unknown events are non-fatal only after the connection has passed required security gates for the message direction. Unknown or malformed privileged App messages before successful signed resume MUST NOT become App behavior or Runtime behavior.

Connection security failure mapping:

| Failure | Required diagnostic |
| --- | --- |
| Insecure transport or attempted downgrade from HTTPS/WSS to HTTP/WS | `insecureTransport` |
| Trusted Runtime presents a different `runtime_id` | `runtimeIdentityMismatch` |
| Trusted Runtime presents a different `runtime_public_key` or `runtime_public_key_fingerprint` | `runtimeKeyChanged` |
| Tunnel URL is stale, expired, unreachable, throttled, or otherwise unavailable | no trust diagnostic; treat as connection failure only |
| `session.resume` uses the wrong signed route context | `routeMismatch` |
| `session.resume` timestamp is outside endpoint policy | `staleResumeTimestamp` |
| `session.resume` nonce was already accepted within the replay window | `reusedResumeNonce` |
| `session.resume` signature, algorithm, key ID, or public key verification fails | `invalidSignature` |
| `session.resume` targets an unknown, pending, rejected, expired, disabled, or Session-unbound Device | `deviceNotTrusted` |
| `session.resume` targets a Runtime-revoked Device | `runtimeRevokedDevice` |
| `session.resume` targets a Session past idle timeout, absolute lifetime, or invalidated lifecycle state | `sessionExpired` |

Security threat model:

- Direct Runtime mode: the App connects to a Runtime over HTTPS/WSS, including through a tunnel URL. The App must validate the RuntimeIdentity and expected public key fingerprint before trust. A valid TLS connection alone is not sufficient Runtime trust.
- Tunnel infrastructure: a tunnel may route TCP/TLS/WebSocket traffic to the Runtime, but it is not a protocol actor and must not be trusted for Runtime or Device identity. The endpoints remain App and Runtime.
- Local Device compromise: if an attacker gains use of the Device private key or an unlocked App secret store, the attacker may be able to resume authorized Sessions until the Device or Session is revoked. Implementations MUST generate non-exportable, hardware-backed Device private keys when the platform supports it.
- Stolen Session IDs: a `session_id` is a bearer-style secret but must not be sufficient to resume an App Session. App resume requires a valid Device signature over the Session, Runtime, Device, nonce, timestamp, key ID, and route context.
- Replay attacks: endpoints must reject reused resume nonces, stale resume timestamps, signatures over a different Runtime, signatures over a different route context, and signatures made by keys not bound to the paired Device.
- Network/tunnel interference: infrastructure may drop, delay, replay, or reorder whole WebSocket messages across reconnects. Endpoints must treat resume authentication, event ordering, and idempotency as endpoint responsibilities.
- Rate-limited tunnels: Apps and Runtimes must tolerate slow or throttled tunnel transport with bounded reconnect backoff and idempotent resume behavior. Tunnel throttling must not weaken Runtime identity validation, Device signature verification, replay checks, or Pairing rules.
- Runtime identity changes: an unexpected `runtime_id`, `runtime_public_key`, or `runtime_public_key_fingerprint` change for an existing trusted Runtime is a security event and must fail closed until explicit user or admin action restores trust.
- Revoked Devices: Runtime policy must reject resume for revoked, expired, disabled, or unknown Device identities even when the `session_id` is otherwise valid.
- Log and storage leakage: Session IDs, private keys, signatures, authorization material, transfer credentials, and raw secret-bearing frames must be treated as sensitive and redacted from logs and non-secret storage.

Each RIPDOCK Device has its own Device identity. Trust granted to one Device must not silently grant trust to another Device, even when Runtime metadata is synced across a user's Devices.

A Session is a durable/recoverable conversation routing scope. A WebSocket connection is only the current transport attachment for one side of that Session.

Session IDs are opaque strings.

If a second App socket resumes the same Session, the Runtime endpoint MUST replace the previous socket and close the replaced socket with WebSocket close code `1000` and reason `Replaced by a new App connection.`.

Reconnect semantics:

- WebSocket connections are disposable and MAY be recreated at any time.
- Apps reconnect with the same `session_id` in signed `session.resume` when the durable Session is still valid. Runtime-side reconnect behavior is endpoint-defined and must not require the Runtime to initiate resume with an App.
- Reconnects MUST include the same persistent App Device identity and expected Runtime identity.
- App reconnects must sign `session.resume` with the paired Device private key.
- Resume MUST preserve Session security state. Runtime-owned conversation continuity MAY be restored for known `conversation_id` values.
- The newest valid App socket owns the App transport attachment for the Session.
- A recoverable Session MUST survive WebSocket disconnects, mobile reconnects, and temporary network outages while the Runtime has durable Session state and the Session has not expired or been revoked.
- Runtime endpoints must enforce Session lifecycle policy: idle timeout, absolute lifetime, and revocation invalidation.
- Runtime endpoints MAY rotate the `session_id` after successful signed resume. When they do, the replacement `session_id` is returned in `session.resumed` and becomes the only valid Session ID for later resumes.
- The Runtime MAY emit `session.disconnected` when the App drops and `session.resumed` when a new WebSocket resumes the Session.
- The Runtime MUST emit `session.expired` when a `session.resume` request targets a Session that can no longer be resumed.

Durability expectations:

- Identity is persistent across Pairings, reconnects, and app launches.
- Pairing/trust is persistent until revoked, expired by policy, or replaced.
- Runtime public key changes are not normal reconnects. An unexpected key change is equivalent to an SSH host key mismatch.
- Session state is recoverable across transient transport failures.
- WebSocket transport is ephemeral and must not define Session lifetime by itself.
- Runtimes remain responsible for Runtime-owned conversation continuity and replay behavior.

State storage expectations:

- Runtime-owned `RuntimeMetadata` MAY be cached locally or synced for display consistency, but the Runtime remains the source of truth.
- Local or remote state sync must never silently grant access to a Runtime.
- Device private keys must not be stored in protocol models or synced as Runtime metadata.
- Device private keys must be stored according to the App's local security policy and MUST be generated as non-exportable hardware-backed keys when platform support allows it.
- A cached trust record in `unpaired`, `pendingApproval`, or `identityMismatch` state does not authorize reconnect.
- A cached trusted record without `session_id` means the Runtime may be trusted but is not chat-ready.
- RIPDOCK Apps must refuse automatic reconnect when a Runtime presents a different public key or public key fingerprint than the trusted `RuntimeIdentity`.

Security-first typed models:

- `RuntimeIdentity`: `runtimeId`, `displayName`, `publicKey`, `publicKeyFingerprint`, `createdAt`, `protocolVersion`.
- `RuntimeMetadata`: `displayName`, `icon`, `accentColor`, `backgroundColor`.
- `DeviceIdentity`: `deviceId`, `deviceName`, `publicKey`, `publicKeyFingerprint`, `createdAt`.
- `TrustState`: `unpaired`, `pendingApproval`, `trusted`, `rejected`, `expired`, `revoked`, `notFound`, `identityMismatch`, `disabled`.
- `PairingQrPayload`: `runtime_url`, `pairing_code`, and optional Runtime identity fields.
- `PairingResult`: `runtimeId`, `deviceId`, `trustState`, `message`, Runtime metadata and App-visible Agent definitions only when trusted, and durable Session fields when chat is available.
- `ConnectionSecurityError`: `insecureTransport`, `runtimeIdentityMismatch`, `runtimeKeyChanged`, `deviceNotTrusted`, `pairingExpired`, `runtimeRevokedDevice`, `invalidSignature`, `staleResumeTimestamp`, `reusedResumeNonce`, `routeMismatch`, `sessionExpired`, `unsupportedProtocolVersion`.

Public key fields in `RuntimeIdentity`, `DeviceIdentity`, `app_public_key`, and `runtime_public_key` MUST be strict P-256 JWK-compatible objects:

```json
{
  "crv": "P-256",
  "key_id": "<sha256-x-y-lowercase-hex>",
  "kty": "EC",
  "x": "<base64url-p256-x-coordinate-no-padding>",
  "y": "<base64url-p256-y-coordinate-no-padding>"
}
```

No other public key encodings are valid in v1. The `x` and `y` values are each the 32-byte P-256 affine coordinate encoded as base64url without padding. `key_id` is SHA-256 over the raw coordinate bytes `x || y`, encoded as 64 lowercase hex characters. `publicKeyFingerprint`, `app_public_key_fingerprint`, and `runtime_public_key_fingerprint` MUST equal the corresponding public key object's `key_id`.

Pairing/trust success responses must include durable Session fields when chat is available:

- `session_id`: required when a `trusted` response is chat-ready. Apps use it in the first `session.resume` message on `wss://<runtime-host>/ripdock/app`.

Pairing status and trusted Runtime lookup responses must return `session_id` for trusted Devices when chat is available. A Runtime may be trusted but not chat-usable if `session_id` is absent; Apps must treat that state as not chat-ready and must not synthesize a Session ID from `runtime_id`, `conversation_id`, or any other field.

Pairing status responses MUST NOT include Runtime-owned display metadata or Agent definitions unless the Device is trusted. Pending, rejected, expired, revoked, not found, and identity mismatch responses must expose only Pairing state and identity material needed to complete or diagnose Pairing.
Trusted Pairing status responses SHOULD include current Runtime-owned display metadata and enabled, App-visible Agent definitions so Apps can refresh Runtime and Agent metadata without using an unauthenticated metadata lookup.

These models carry public identity and metadata only. They must not contain private keys, refresh tokens, or other secrets. Opaque `session_id` values are secret-bearing material and must be stored according to the App's local secret-storage policy, not as public Runtime metadata.

Session ownership expectations:

- The Runtime owns Runtime behavior and output.
- The App owns local presentation and user intent.
- The Runtime owns Session binding, resume validation, and Runtime conversation continuity.

## 10. Routes

Protocol v1 public routes are limited to the routes in this section.
Implementation-owned admin, dashboard, diagnostics, development, and operator
routes are outside Protocol v1 and MUST NOT be exposed as public App protocol
routes.

### `GET /.well-known/ripdock/runtime-identity`

Public Runtime identity discovery endpoint.

The response body is a JSON object conforming to
`runtime-identity-model.schema.json`.

Rules:

- The endpoint MUST use HTTPS.
- The response contains public Runtime identity only.
- The response MUST NOT contain Session IDs, Pairing material, Device state,
  Runtime-owned mutable UI metadata, Agent definitions, admin information,
  private keys, refresh tokens, or other secrets.
- Apps MUST validate the returned `runtimeId`, `publicKey`, and
  `publicKeyFingerprint` before treating a Runtime connection as trusted.
- Runtime base URLs, Tunnel URLs, hostnames, certificate subjects, and URL
  strings are connection locations only and MUST NOT replace Runtime identity
  validation.

### `GET /.well-known/ripdock/runtime-metadata`

Trusted Runtime-owned UI metadata endpoint. Apps MUST NOT fetch or render Runtime-owned display metadata or Agent definitions before Pairing has established trust.

The response body is a JSON object conforming to `runtime-metadata-response.schema.json`.

Rules:

- Runtimes SHOULD require an authorized trusted Device context for this endpoint. If no trusted Device context is available, the endpoint MUST NOT expose Runtime-owned display metadata or Agent definitions.
- The endpoint must expose only Runtime-owned UI metadata to trusted Devices.
- The response object must contain `runtimeMetadata` conforming to `runtime-metadata.schema.json`.
- The response object may contain `runtimeAgents`, an array of Agent definitions conforming to `runtime-agents.schema.json#/$defs/agent_definition`. When present, `runtimeAgents` MUST contain only enabled, App-visible Agents and MUST be returned only for trusted Devices.
- Metadata fields use camelCase names.
- `runtimeMetadata.displayName` and `runtimeMetadata.backgroundColor` are required. `backgroundColor` MUST default to `#ffffff` when unavailable.
- The endpoint must not expose secrets, Pairing tokens, Device keys, admin information, pending/trusted Device state, or private Runtime state.
- Metadata is mutable Runtime configuration and must not modify RuntimeIdentity cryptographic fields.

### `POST /ripdock/pairing/request`

HTTP JSON route used by an App to request Runtime approval for a Device.

The request body is a JSON object conforming to
`device-identity-model.schema.json`.

The response body is a JSON object conforming to
`pairing-result.schema.json`.

Rules:

- The endpoint MUST use HTTPS.
- The route creates or refreshes a pending Pairing request according to Runtime
  policy.
- Pairing request bodies carry public Device identity and MUST NOT contain
  Device private keys, Session IDs, Pairing codes, resume signatures, nonces,
  transfer credentials, or other secrets.
- Runtime responses MUST follow Pairing result visibility rules: pending,
  rejected, expired, revoked, not found, and identity mismatch responses must
  expose only Pairing state and identity material needed to complete or
  diagnose Pairing. Trusted responses MAY include `session_id`,
  `runtimeMetadata`, and `runtimeAgents` as defined by
  `pairing-result.schema.json`.

### `POST /ripdock/pairing/status`

HTTP JSON route used by an App to read Pairing status for a Device without
creating a new Pairing request.

The request body is a JSON object conforming to
`device-identity-model.schema.json`.

The response body is a JSON object conforming to
`pairing-result.schema.json`.

Rules:

- The endpoint MUST use HTTPS.
- The route MUST be read-only and MUST NOT create a pending Pairing request.
- Protocol v1 defines no query-string Pairing status route. Apps and Runtimes
  MUST use POST with a JSON body.
- Pairing status request bodies carry public Device identity and MUST NOT
  contain Device private keys, Session IDs, Pairing codes, resume signatures,
  nonces, transfer credentials, or other secrets.
- Runtime responses MUST follow Pairing result visibility rules. Trusted
  responses MAY include `session_id`, `runtimeMetadata`, and `runtimeAgents` as
  defined by `pairing-result.schema.json`.

### `GET /ripdock/app/pair/:pairingCode`

WebSocket route used by an App to bind a Runtime Pairing code.

On success, the Runtime:

1. Marks the Pairing code as bound.
2. Associates persistent App and Runtime identities into a trust relationship when provided.
3. Connects the WebSocket as the current App transport for the Session.
4. Sends `pairing.connected`.

On invalid, expired, malformed, or already-bound code, the Runtime opens the socket, sends `error`, and closes it.

### `GET /ripdock/app`

WebSocket route used by an App to join an existing Session directly.

The App must send signed `session.resume` as the first protocol message after opening this WebSocket. The `session_id` in that message is the durable per-Runtime Session ID returned by Pairing/trust success or trusted Pairing status lookup. It is not the Runtime base URL, `runtime_id`, or `conversation_id`.

### `GET /ripdock/transfer/:transferId/:role`

WebSocket route used for App-to-Runtime file transfer chunks.

Rules:

- The endpoint MUST use WSS.
- `transferId` identifies the transfer announced by `transfer.ready`.
- `role` identifies the connecting transfer side. Protocol v1 defines
  `"app"` and `"runtime"` role path values.
- File bytes MUST NOT be sent over the main protocol WebSocket.
- The transfer route MUST enforce the transfer ID, role, expiry, size, MIME,
  and chunk limits advertised by protocol events and endpoint policy.
- Transfer URLs are sensitive operational material and MUST be redacted from
  logs and non-secret storage.

### `GET /ripdock/transfer/:transferId/artifact`

HTTPS route used by the App to download Runtime-generated artifact bytes.

Rules:

- The endpoint MUST use HTTPS.
- The response body is artifact bytes, not protocol JSON.
- `transferId` identifies the Runtime-to-App artifact transfer announced by
  `runtime.transfer.request`.
- Downloaded bytes MUST match the declared `size_bytes` and `sha256` values
  before the App acknowledges `runtime.transfer.completed`.
- Artifact download URLs are sensitive operational material and MUST be redacted
  from logs and non-secret storage.

## 11. Current V1 Events

### `pairing.created`

Direction: Runtime internal/local UI.

Required fields:

- `type`: `"pairing.created"`
- `protocol_version`: `"1"`
- `pairing_code`: six-digit string
- `session_id`: opaque string

### `pairing.connected`

Direction: Runtime to App.

Required fields:

- `type`: `"pairing.connected"`
- `protocol_version`: `"1"`
- `session_id`: opaque string

Common fields:

- `trust_id`: durable trust relationship identifier.
- `app_device_id`: persistent App Device identity.
- `app_public_key`: App Device P-256 JWK public key object used to verify signed Session resume.
- `app_public_key_fingerprint`: stable fingerprint of the App Device public key. This MUST equal `app_public_key.key_id`.
- `app_display_name`: App Device display name.
- `device_identity`: typed DeviceIdentity metadata for the App Device.
- `runtime_id`: persistent Runtime identity.
- `runtime_public_key`: Runtime P-256 JWK public key object used for Runtime identity validation.
- `runtime_public_key_fingerprint`: stable fingerprint of the Runtime public key. This MUST equal `runtime_public_key.key_id`.
- `runtime_identity`: typed RuntimeIdentity metadata for the Runtime.
- `runtime_metadata`: typed RuntimeMetadata for the Runtime.
- `trust_state`: current trust state for this Device and Runtime relationship.
- `selected_runtime_type`: selected Runtime type for the Session.
- `app_metadata.selected_runtime_type`: selected Runtime type recorded by the App.
- `session_metadata.selected_runtime_type`: selected Runtime type recorded for the Session.

### `app.identity`

Direction: App to Runtime.

`app.identity` announces the persistent App Device identity. It may be sent during Pairing, after Pairing, or before `session.resume` on a new WebSocket connection.

Required fields:

- `type`: `"app.identity"`
- `protocol_version`: `"1"`
- `app_device_id`: stable App installation or Device identifier.

Common fields:

- `app_public_key`: App Device P-256 JWK public key object used to verify signed Session resume.
- `app_public_key_fingerprint`: stable fingerprint of the App Device public key. This MUST equal `app_public_key.key_id`.
- `app_display_name`: App Device display name.
- `device_identity`: typed DeviceIdentity metadata for the App Device.

### `conversation.create`

Direction: App to Runtime.

`conversation.create` starts a new durable Runtime-owned conversation without submitting user content. It is the only v1 App message that requests Runtime conversation creation.

Required fields:

- `type`: `"conversation.create"`
- `protocol_version`: `"1"`
- `runtime_id`: stable Runtime identity string.
- `agent_id`: Runtime-scoped Agent identity string.
- `client_message_id`: App-created opaque idempotency and correlation ID for this conversation creation request.

Forbidden fields:

- `conversation_id`: Apps MUST NOT send `conversation_id` in `conversation.create`; the Runtime always provides it.
- `content`: Apps MUST NOT send user content in `conversation.create`; user content is sent with `message.create` after `conversation.created`.
- `transfer_ids`: v1 does not support file transfer attachment on `conversation.create`; Apps MUST create the conversation first, complete transfer setup for that conversation, then send `message.create`.

The Runtime processes this event to the active Runtime side of the Session unless endpoint policy rejects it. The Runtime must reject `conversation.create` when `runtime_id` is missing, `agent_id` is missing, `client_message_id` is missing, `conversation_id` is present, `content` is present, `transfer_ids` is present, `runtime_id` does not identify the active Runtime, or `agent_id` is unknown for that Runtime.

The resumed Device must have the `message:create` authorization scope.

Apps MUST NOT create durable App conversation records before a Runtime-owned `conversation_id` exists. Apps may present an empty draft conversation UI for an Agent, but intro text, prompts, suggestions, and placeholders in that UI are not protocol messages and MUST NOT be persisted as conversation history.

For an accepted `conversation.create`, the Runtime MUST create a durable conversation for the Runtime and Agent, create or bind any Runtime-owned backing Session state required to process future messages, preserve the App Session, and emit exactly one `conversation.created` event containing the created `conversation_id`. The Runtime MUST NOT route user content, execute slash commands, emit assistant `message.delta`, emit `message.block`, or emit `message.completed` as part of `conversation.create`. The created `conversation_id` is the durable Runtime-owned identifier for subsequent `message.create`, `conversation.sync`, `conversation.delete`, and title-generation requests.

After `conversation.created` is emitted, the App sends user content with `message.create` using the returned `conversation_id`. The App MUST NOT infer that any user message was sent by `conversation.create`.

`client_message_id` is the idempotency key for `conversation.create` within a resumed Session and Agent. If the Runtime receives the same `client_message_id` again after accepting it, the Runtime MUST NOT create a second conversation. It MUST either re-emit the same `conversation.created` mapping or reject the duplicate with `protocol.invalid_payload` if the original mapping cannot be recovered.

### `message.create`

Direction: App to Runtime.

`message.create` submits a user message to an existing Runtime-owned conversation.

Required fields:

- `type`: `"message.create"`
- `protocol_version`: `"1"`
- `runtime_id`: stable Runtime identity string.
- `agent_id`: Runtime-scoped Agent identity string.
- `conversation_id`: Runtime-owned conversation scope.
- `client_message_id`: App-created opaque correlation ID for this send attempt.
- `content`: non-empty string containing at least one non-whitespace character

The Runtime processes this event to the active Runtime side of the Session unless endpoint policy rejects it. The Runtime must reject `message.create` when `runtime_id` is missing, `agent_id` is missing, `client_message_id` is missing, `runtime_id` does not identify the active Runtime, or `agent_id` is unknown for that Runtime.

The resumed Device must have the `message:create` authorization scope.

V1 `content` is non-empty UTF-8 text and must contain at least one non-whitespace character. Markdown behavior is Runtime/App-defined.

`message.create` may reference a completed v1 transfer by including `transfer_ids`. In v1, `transfer_ids` is limited to one ID per message. The endpoint must reject empty, unknown, or incomplete transfer IDs with `protocol.invalid_payload`.

The Runtime MUST route the content to the existing Runtime-owned conversation identified by `conversation_id` or reject it with `conversation.not_found`.

### `conversation.created`

Direction: Runtime to App.

`conversation.created` is the terminal success result for a `conversation.create` request. It announces the durable Runtime-owned conversation. It does not carry user content or assistant output.

Required fields:

- `type`: `"conversation.created"`
- `protocol_version`: `"1"`
- `runtime_id`: stable Runtime identity string.
- `agent_id`: Runtime-scoped Agent identity string.
- `conversation_id`: stable Runtime Agent conversation identifier.
- `client_message_id`: the `client_message_id` from the accepted `conversation.create` request. Apps MUST treat this as a terminal success receipt for conversation creation only.
- `created_at`: UTC RFC3339 Runtime conversation timestamp, with `Z` timezone. Fractional seconds are allowed.

Optional fields:

- `title`: optional Runtime-owned user-facing conversation title. When present, this value MUST come from the Runtime conversation title cache for the `conversation_id`.

Apps MUST use `client_message_id` to reconcile any pending conversation creation state. Apps MUST de-duplicate conversations by `runtime_id`, `agent_id`, and `conversation_id`. Apps send all user-visible content, including the first user message, with `message.create` after receiving `conversation.created`.

### `message.delta`

Direction: Runtime to App.

Required fields:

- `type`: `"message.delta"`
- `protocol_version`: `"1"`
- `delta`: string.

Common fields:

- `conversation_id`: string
- `message_id`: string
- `artifact_ids`: generated artifact IDs attached to the completed assistant message.

Receivers must accept `message_id` as optional when the event schema allows it.

V1 `message.delta` is append-only stream text. Consumers MUST append deltas in the order received for the same `conversation_id` and `message_id`. V1 does not define overwrite or diff semantics.

`message.delta` is the streaming text event. Runtimes MUST emit it for ordinary incremental assistant text in v1.

### `message.block`

Direction: Runtime to App.

`message.block` is a discrete semantic content event. It lets a Runtime declare the kind and content type of a complete block while the App owns visual presentation.

Required fields:

- `type`: `"message.block"`
- `protocol_version`: `"1"`
- `block`: object.
- `block.kind`: semantic block kind
- `block.mime_type`: content type
- `block.content`: UTF-8 text content

Common fields:

- `conversation_id`: string
- `message_id`: string
- `block.language`: language identifier for code or data when useful
- `block.title`: optional display title
- `block.copyable`: whether the App may expose a copy affordance
- `block.wrap`: whether wrapping is semantically acceptable
- `block.collapsed`: whether the Runtime declares initial collapsed presentation

Supported first-wave semantic block kinds:

- `text`: MessageText
- `markdown`: MarkdownBlock
- `code`: CodeBlock
- `log`: LogBlock
- `data`: DataBlock

Supplemental Runtime activity block kinds:

- `activity.status`: compact Runtime status update.
- `activity.plan`: user-visible planning/checklist update.
- `activity.notice`: user-visible Runtime notice that is not ordinary assistant prose.
- `activity.tool.call`: Runtime tool operation was requested or started.
- `activity.tool.progress`: Runtime tool operation progress.
- `activity.tool.result`: Runtime tool operation completed with a user-visible result summary.
- `activity.tool.error`: Runtime tool operation failed.
- `activity.tool.retry`: Runtime is retrying a tool or provider operation.
- `activity.file.search`: Runtime file search progress.
- `activity.file.resolve`: Runtime file/artifact resolution progress.
- `activity.artifact.register`: Runtime artifact registration progress.
- `activity.code.run`: Runtime code or shell execution progress.
- `activity.model.info`: Runtime model/provider progress or diagnostic metadata.
- `artifact.reference`: reference to a generated artifact known to the Runtime.

These supplemental kinds are OPTIONAL. They are for renderable transcript items and do not require the App to understand Runtime-specific tool names. The Runtime MUST include the native tool name and arguments only as data inside the block content, not in the block kind.

Supported first-wave MIME/content types:

- `text/plain`
- `text/markdown`
- `text/code`
- `text/log`
- `application/json`
- `application/yaml`
- `application/vnd.ripdock.activity+json`
- `application/vnd.ripdock.artifact+json`

Runtime/App ownership:

- The Runtime owns semantic intent: kind, MIME/content type, language, title, content, and lightweight presentation hints.
- The App owns visual styling and rendering.
- The Runtime must not control colors, fonts, layout, CSS, or platform-specific view styling.

Activity/tool block content MUST be JSON for `application/vnd.ripdock.activity+json`. Required and OPTIONAL fields:

- `category`: REQUIRED Runtime-neutral category. Allowed values are `command`, `file`, `search`, `browser`, `media`, `memory`, `skill`, `delegation`, `background_job`, `message_delivery`, and `runtime`.
- `status`: REQUIRED status. Allowed values are `pending`, `running`, `completed`, `failed`, and `retrying`.
- `summary`: REQUIRED short user-visible summary.
- `tool`: OPTIONAL Runtime-native tool name.
- `detail_id`: OPTIONAL Runtime-owned reference for raw details.
- `args`: OPTIONAL sanitized arguments or preview. Runtimes MUST NOT put secrets in this field.

Block kinds outside the schema enum are invalid v1 protocol values and MUST be rejected with `protocol.invalid_payload`.

`message.block` is not a replacement for `message.delta`. A Runtime MAY stream explanatory text with `message.delta` and then emit one or more complete semantic blocks with `message.block`.

V1 `message.block` content is text inside JSON. It does not add HTML rendering, attachment upload transport, binary payloads on the main protocol socket, or arbitrary styling/CSS.

### RipDock Rich Text v1

RipDock Rich Text v1 is a stable formatting/rendering contract for text content exchanged by Runtimes and Apps. It is transport/schema only. It defines the syntax an App may advertise and render; it does not define a renderer, parsing algorithm, theme, CSS, inference behavior, orchestration behavior, memory, tool execution internals, or attachment upload transport.

Rich Text v1 content remains UTF-8 text. Runtimes MAY use it in streaming text or `message.block` content when App capabilities indicate support. Apps own rendering and visual presentation.

Supported syntax:

- `**bold**`
- `*italic*`
- `__underline__`
- `` `inline code` ``
- fenced code blocks with triple backticks, with an optional language identifier
- bullet lists
- numbered lists
- blockquotes using `>`
- URLs

Unsupported syntax:

- HTML
- markdown tables
- LaTeX
- embedded remote images
- arbitrary markdown extensions

Renderer expectations:

- Apps that advertise Rich Text v1 MUST render only the supported Rich Text v1 syntax.
- Unsupported formatting must render as plain text.
- Malformed syntax must degrade safely to text without breaking message display.
- URLs must open externally through the platform browser or equivalent external handler.
- Apps MUST keep code block content copyable when their UI exposes copy affordances, but the protocol does not require a specific control.

Security expectations:

- Apps must not render arbitrary HTML from Rich Text v1 content.
- Apps must not execute scripts, inline event handlers, custom markdown extensions, or remote embedded content from Rich Text v1 content.
- Apps must not fetch or render embedded remote images as part of Rich Text v1.
- URL rendering must treat the displayed URL as untrusted text and use platform URL handling.

### `message.completed`

Direction: Runtime to App.

Required fields:

- `type`: `"message.completed"`
- `protocol_version`: `"1"`

Common fields:

- `conversation_id`: string
- `message_id`: string

The event marks the Runtime stream complete for the referenced conversation/message.

Runtime-initiated assistant messages MAY be sent as ordinary `message.delta` and `message.completed` events for a known `conversation_id` without a preceding App `message.create`. Runtimes MUST persist such messages when they are part of durable conversation history so they are available through `conversation.sync` for disconnected Apps.

### `conversation.list`

Direction: App to Runtime.

`conversation.list` requests durable Runtime-owned conversation summaries for one Runtime Agent. It is the App discovery mechanism for conversations that may exist on the Runtime before the App has a local conversation record.

Required fields:

- `type`: `"conversation.list"`
- `protocol_version`: `"1"`
- `runtime_id`: stable Runtime identity string.
- `agent_id`: Runtime-scoped Agent identity string.

The resumed Device must have the `conversation:list` authorization scope.

The Runtime MUST reject `conversation.list` when `runtime_id` is missing, `agent_id` is missing, `runtime_id` does not identify the active Runtime, or `agent_id` is unknown for that Runtime.

Apps SHOULD send `conversation.list` when loading or switching the active Agent and when the user explicitly requests a refresh. Apps MUST NOT poll `conversation.list` in the background.

### `conversation.listed`

Direction: Runtime to App.

`conversation.listed` returns durable Runtime-owned conversation summaries for a `conversation.list` request. It is a summary response, not a message history response. Apps use `conversation.sync` to fetch messages after the user activates a listed conversation.

Required fields:

- `type`: `"conversation.listed"`
- `protocol_version`: `"1"`
- `runtime_id`: stable Runtime identity string.
- `agent_id`: Runtime-scoped Agent identity string.
- `conversations`: ordered array of conversation summary objects.

Conversation summary object fields:

- `conversation_id`: stable Runtime Agent conversation identifier.
- `title`: optional user-facing conversation title.
- `created_at`: optional UTC RFC3339 Runtime conversation timestamp, with `Z` timezone. Fractional seconds are allowed.
- `updated_at`: optional UTC RFC3339 Runtime conversation timestamp, with `Z` timezone. Fractional seconds are allowed.
- `message_count`: optional non-negative count of durable user and assistant messages known to the Runtime for this conversation.
- `preview`: optional UTF-8 text preview of the conversation.

`conversations` MUST be ordered by `updated_at` descending when `updated_at` is available, otherwise by `conversation_id` ascending after timestamped conversations. A Runtime MUST NOT include messages, transfer data, artifact bytes, download URLs, Session IDs, Pairing material, Device secrets, or Runtime-private tool state in `conversation.listed`.

The Runtime MUST maintain durable title metadata for Runtime-owned conversations. When a cached title exists for a listed `conversation_id`, `conversation.listed` MUST return that cached title. If no cached title exists, the Runtime MAY omit `title` or return a Runtime-derived fallback title. The Runtime MUST NOT treat App-local user renames as Runtime-owned title metadata unless a protocol-defined Runtime title update request exists.

Apps MUST de-duplicate listed summaries by `conversation_id` for the same `runtime_id` and `agent_id`. Apps MAY hide conversations locally, but local hiding MUST NOT send protocol traffic and MUST NOT require Runtime state. Apps MUST NOT resurrect a locally tombstoned conversation from `conversation.listed` after a confirmed `conversation.deleted` for the same `runtime_id`, `agent_id`, and `conversation_id`.

### `conversation.sync`

Direction: App to Runtime.

`conversation.sync` requests durable Runtime-owned conversation state for one Runtime Agent conversation after a Runtime-provided timestamp cursor. It is the App reconnect reconciliation mechanism for messages that completed while the App was disconnected.

Required fields:

- `type`: `"conversation.sync"`
- `protocol_version`: `"1"`
- `runtime_id`: stable Runtime identity string.
- `agent_id`: Runtime-scoped Agent identity string.
- `conversation_id`: Runtime-owned conversation scope.
- `after`: UTC RFC3339 timestamp cursor previously provided by the Runtime, with `Z` timezone. Fractional seconds are allowed.

The resumed Device must have the `conversation:sync` authorization scope.

The Runtime MUST reject `conversation.sync` when `runtime_id` is missing, `agent_id` is missing, `conversation_id` is missing, `after` is missing or not a valid UTC RFC3339 timestamp, `runtime_id` does not identify the active Runtime, or `agent_id` is unknown for that Runtime.

`after` is a Runtime-owned high-water mark. Apps MUST NOT generate sync cursors from the App clock. Apps MUST store the `cursor` returned by `conversation.synced` and send that exact value as `after` on a later sync for the same `runtime_id`, `agent_id`, and `conversation_id`.

### `conversation.synced`

Direction: Runtime to App.

`conversation.synced` returns durable Runtime-owned conversation messages for a `conversation.sync` request. It is a snapshot response, not a streaming delta event.

Required fields:

- `type`: `"conversation.synced"`
- `protocol_version`: `"1"`
- `runtime_id`: stable Runtime identity string.
- `agent_id`: Runtime-scoped Agent identity string.
- `conversation_id`: Runtime-owned conversation scope.
- `after`: the request cursor this response reconciles.
- `cursor`: UTC RFC3339 timestamp cursor owned by the Runtime, with `Z` timezone. Fractional seconds are allowed.
- `messages`: ordered array of synced message objects.

Synced message object fields:

- `message_id`: stable Runtime-created message identifier.
- `role`: `"user"` or `"assistant"`.
- `content`: UTF-8 text content.
- `created_at`: UTC RFC3339 Runtime message timestamp, with `Z` timezone. Fractional seconds are allowed.
- `completed_at`: optional UTC RFC3339 Runtime message completion timestamp, with `Z` timezone. Fractional seconds are allowed.

The Runtime MUST include every available message in the requested conversation with `created_at` greater than `after`. The Runtime MAY include messages with `created_at` equal to `after` to avoid precision-boundary loss. Apps MUST de-duplicate synced messages by `message_id`.

Messages MUST be ordered by `created_at` ascending, then `message_id` ascending. `cursor` MUST be greater than or equal to every returned message `created_at`. If no messages are returned, `cursor` MUST be greater than or equal to `after`.

`conversation.synced` MUST NOT transfer files, artifact bytes, download URLs, transfer URLs, Session IDs, Pairing material, Device secrets, or Runtime-private tool state. Generated artifacts remain represented only by existing artifact metadata and transfer events.

Runtime implementations MAY use any internal storage format for conversation history. Protocol timestamps on the wire MUST be UTC RFC3339 strings with `Z` timezone.

### `conversation.title.generate`

Direction: App to Runtime.

`conversation.title.generate` requests a short user-facing title for an existing Runtime Agent conversation. Title generation is metadata work for the referenced conversation. It is not chat, not a durable message, and not a request to create a new conversation.

Required fields:

- `type`: `"conversation.title.generate"`
- `protocol_version`: `"1"`
- `runtime_id`: stable Runtime identity string.
- `agent_id`: Runtime-scoped Agent identity string.
- `conversation_id`: Runtime-owned conversation scope.
- `messages`: array of 1 to 12 source message objects.

Title source message object fields:

- `role`: `"user"` or `"assistant"`.
- `content`: non-empty UTF-8 text content. Each `content` value MUST contain at least one non-whitespace character and MUST NOT exceed 4000 Unicode scalar values.

The resumed Device must have the `conversation:title:generate` authorization scope.

The Runtime MUST reject `conversation.title.generate` when `runtime_id` is missing, `agent_id` is missing, `conversation_id` is missing, `messages` is missing, `messages` is empty, `messages` has more than 12 items, any message has an unsupported `role`, any message has empty or oversized `content`, `runtime_id` does not identify the active Runtime, or `agent_id` is unknown for that Runtime.

The Runtime MUST NOT process `conversation.title.generate` as `message.create`, MUST NOT emit `message.delta` or `message.completed` for title generation, MUST NOT create a durable Runtime conversation for title generation, MUST NOT persist title-generation source messages into conversation history, and MUST NOT include title-generation work in `conversation.listed` or `conversation.synced`.

For a successful `conversation.title.generate`, the Runtime MUST persist the returned title in durable Runtime-owned title metadata for the referenced `conversation_id` before emitting `conversation.title.generated`. Later `conversation.listed` summaries for the same `runtime_id`, `agent_id`, and `conversation_id` MUST return the persisted title unless a later Runtime title-generation request replaces it.

The Runtime MUST respond with exactly one `conversation.title.generated` or `error` event for each valid `conversation.title.generate` request.

### `conversation.title.generated`

Direction: Runtime to App.

`conversation.title.generated` returns the generated and persisted Runtime-owned title for the referenced Runtime Agent conversation.

Required fields:

- `type`: `"conversation.title.generated"`
- `protocol_version`: `"1"`
- `runtime_id`: stable Runtime identity string.
- `agent_id`: Runtime-scoped Agent identity string.
- `conversation_id`: Runtime-owned conversation scope from the request.
- `title`: non-empty UTF-8 title text containing at least one non-whitespace character and no more than 80 Unicode scalar values.

The Runtime MUST emit only the title text in `title`. The Runtime MUST NOT include explanations, markdown formatting, quotes added solely as formatting, Session IDs, Pairing material, Device secrets, Runtime-private tool state, transfer data, artifact bytes, download URLs, or transfer URLs in `title`.

Apps MUST treat `conversation.title.generated` as generated Runtime-owned metadata for the referenced conversation. Apps MUST NOT replace a user-defined local title with a generated title unless the user explicitly requests that replacement.

### `conversation.delete`

Direction: App to Runtime.

`conversation.delete` requests deletion of one Runtime Agent conversation and its Runtime-owned durable state.

Required fields:

- `type`: `"conversation.delete"`
- `protocol_version`: `"1"`
- `runtime_id`: stable Runtime identity string.
- `agent_id`: Runtime-scoped Agent identity string.
- `conversation_id`: Runtime-owned conversation scope.

Optional fields:

- `runtime_options`: object keyed by Runtime namespace. Each value MUST be an object. The protocol validates only the namespace object shape; each Runtime owns validation and meaning for its namespace value.

The resumed Device must have the `conversation:delete` authorization scope.

The Runtime MUST reject `conversation.delete` when `runtime_id` is missing, `agent_id` is missing, `conversation_id` is missing, `runtime_id` does not identify the active Runtime, or `agent_id` is unknown for that Runtime.

The Runtime MUST respond with exactly one `conversation.deleted`, `conversation.delete_blocked`, or `error` event for each valid `conversation.delete` request.

### `conversation.deleted`

Direction: Runtime to App.

`conversation.deleted` confirms that the Runtime deleted or tombstoned the referenced conversation. Apps MUST remove or tombstone their local copy of that conversation and MUST NOT resurrect it from later Runtime-initiated messages or `conversation.sync` data.

Required fields:

- `type`: `"conversation.deleted"`
- `protocol_version`: `"1"`
- `runtime_id`: stable Runtime identity string.
- `agent_id`: Runtime-scoped Agent identity string.
- `conversation_id`: Runtime-owned conversation scope.

Optional fields:

- `runtime_result`: object keyed by Runtime namespace. Each value MUST be an object. The protocol validates only the namespace object shape; each Runtime owns validation and meaning for its namespace value.

### `conversation.delete_blocked`

Direction: Runtime to App.

`conversation.delete_blocked` tells the App that deletion requires Runtime-specific confirmation or action. Apps MUST NOT delete their local conversation when this event is received.

Required fields:

- `type`: `"conversation.delete_blocked"`
- `protocol_version`: `"1"`
- `runtime_id`: stable Runtime identity string.
- `agent_id`: Runtime-scoped Agent identity string.
- `conversation_id`: Runtime-owned conversation scope.
- `runtime_namespace`: Runtime namespace that owns the blocking condition.
- `reason`: stable Runtime-owned reason string.
- `message`: short user-facing confirmation or action text.

When an App repeats `conversation.delete` with a Runtime-owned confirmation in `runtime_options`, the Runtime MUST validate the option for its namespace before deleting Runtime-owned state.

### `message.cancel`

Direction: App to Runtime.

`message.cancel` requests cancellation of an in-flight assistant message.

Required fields:

- `type`: `"message.cancel"`
- `protocol_version`: `"1"`
- `conversation_id`: conversation scope.
- `message_id`: Runtime-created message scope.

The resumed Device must have the `message:cancel` authorization scope.

### `error`

Direction: Runtime to App, App to Runtime, or local client event.

Required fields:

- `type`: `"error"`
- `protocol_version`: `"1"`
- `code`: canonical error code.
- `message`: diagnostic string.

Common fields:

- `conversation_id`: string
- `connection_security_error`: connection security failure code.

Error semantics:

- `code` is REQUIRED for every protocol `error`.
- `code` MUST be one of the canonical codes defined below.
- `message` is diagnostic only. Apps MUST NOT display `message` verbatim in normal user-facing UI.
- Apps MUST map `code` to App-owned user-facing text.
- Senders MUST NOT include Session IDs, Pairing codes, tokens, signatures, nonces, private key material, transfer URLs, or download URLs in `message`.
- `connection_security_error` MAY be included only when the error is caused by connection security, Runtime identity, Pairing trust, Device trust, signed resume verification, Session lifecycle, or insecure transport.
- `connection_security_error` is diagnostic protocol state. Apps MUST NOT display it verbatim in normal user-facing UI.

Connection security failure codes:

| ConnectionSecurityError | Meaning | Required receiver behavior |
| --- | --- | --- |
| `insecureTransport` | App/Runtime communication attempted `http://`, `ws://`, or an insecure downgrade. | Reject the connection attempt before identity fetch, Pairing, or Session resume. |
| `runtimeIdentityMismatch` | Runtime identity did not match the expected trusted Runtime identity. | Fail closed and require explicit user or admin action before trust resumes. |
| `runtimeKeyChanged` | Runtime public key or fingerprint changed for an existing trusted Runtime identity. | Fail closed and require explicit user or admin action before trust resumes. |
| `deviceNotTrusted` | The Device is unknown, unpaired, pending, rejected, expired, disabled, or otherwise not trusted for the Runtime. | Treat the Session as not resumed and require Pairing or admin action according to trust state. |
| `pairingExpired` | Pairing code, invite, or pending Pairing state expired. | Require a fresh Pairing code or QR payload. |
| `runtimeRevokedDevice` | Runtime revoked the Device or invalidated the Device's Sessions. | Require Pairing or admin action before chat resumes. |
| `invalidSignature` | Signed resume verification failed. | Treat the Session as not resumed. Invalid signatures MUST NOT consume nonce replay state. |
| `staleResumeTimestamp` | Signed resume timestamp was outside the accepted endpoint window. | Treat the Session as not resumed; retry only with a freshly signed resume. |
| `reusedResumeNonce` | Signed resume nonce was already used within the replay window. | Treat the Session as not resumed; retry only with a freshly signed resume. |
| `routeMismatch` | Signed resume route context did not match the WebSocket route that received it. | Treat the Session as not resumed and reconnect only to the correct route. |
| `sessionExpired` | Session can no longer be resumed because lifecycle policy expired or invalidated it. | Require Pairing or a new trusted Session before chat resumes. |
| `unsupportedProtocolVersion` | The connection used an unsupported protocol version. | Do not continue the connection under v1. |

Canonical v1 error codes:

| Code | Emitter | Meaning | Required receiver behavior |
| --- | --- | --- | --- |
| `transport.invalid_json` | App or Runtime endpoint | A main-socket text frame was not valid JSON. | Treat the frame as rejected. The connection MAY remain open. |
| `transport.invalid_message` | App or Runtime endpoint | A main-socket frame was not a JSON object, or a binary frame was received. | Treat the frame as rejected. Binary-frame receivers MUST close with code `1003`. |
| `transport.missing_type` | App or Runtime endpoint | A JSON object omitted a non-empty string `type`. | Treat the frame as rejected. |
| `message.too_large` | App or Runtime endpoint | A main-socket message exceeded `endpoint.policy.payload.max_message_bytes`. | Treat the frame as rejected. Sender MUST close with code `1009`. |
| `message.runtime_mismatch` | Runtime endpoint | `conversation.create` or `message.create` targeted a missing or different `runtime_id`. | Treat the message as undelivered. |
| `agent.unavailable` | Runtime endpoint | `conversation.create`, `message.create`, or `agent.settings.update` targeted a missing, disabled, or unadvertised Agent. | Treat the Agent as stale; App MUST refresh Runtime Agent metadata before retrying. |
| `conversation.not_found` | Runtime endpoint | `conversation.sync` targeted an unknown or unavailable conversation for the Runtime and Agent. | Treat the sync as empty for that conversation and continue live message flow. |
| `pairing.invalid` | Runtime endpoint | Pairing code is invalid, expired, or already consumed. | Treat Pairing as failed and require a fresh Pairing code or QR payload. |
| `pairing.rate_limited` | Runtime endpoint | Too many failed Pairing attempts were observed for the endpoint policy window. | Treat Pairing as temporarily failed; retry only after user action. |
| `authorization.denied` | App or Runtime endpoint | The resumed Device lacks the required authorization scope for the privileged message. | Treat the message as rejected and do not retry unchanged. |
| `protocol.invalid_payload` | App or Runtime endpoint | A known event had malformed required fields, wrong field types, invalid nested payload objects, invalid transfer URLs, oversized declared transfer sizes, or invalid transfer references. | Treat the message as rejected and do not partially apply it. |
| `session.resume_required` | Runtime endpoint | A privileged App message was received before signed `session.resume` succeeded. | App MUST resume the Session before sending privileged messages. |
| `session.expired` | Runtime endpoint | The Session can no longer be resumed. | App MUST require Pairing or a new trusted Session before chat resumes. |
| `session.invalid` | Runtime endpoint | The resume request failed without revealing whether the Session, Device, nonce, or key exists. | App MUST treat the Session as not resumed. |
| `session.revoked` | Runtime endpoint | The Device or Session was revoked. | App MUST require Pairing or admin action before chat resumes. |
| `session.signature_invalid` | Runtime endpoint | The resume signature failed verification. | App MUST treat the Session as not resumed. |
| `runtime.rate_limited` | Runtime endpoint | The Runtime rejected the request due to rate limits. | App MUST back off before retrying. |
| `runtime.unavailable` | Runtime endpoint | The Runtime cannot process the request at the time it receives it. | App MAY retry after reconnect or user action. |
| `transfer.invalid_request` | App or Runtime endpoint | A transfer request is malformed or not allowed. | Treat the transfer as failed. |
| `transfer.unsupported_mime_type` | App or Runtime endpoint | The declared MIME type is not accepted. | Treat the transfer as failed. |
| `transfer.file_too_large` | App or Runtime endpoint | The declared or observed transfer size exceeds limits. | Treat the transfer as failed. |
| `transfer.invalid_chunk` | App or Runtime endpoint | A transfer socket received an invalid chunk or text control frame. | Treat the transfer as failed. |
| `transfer.chunk_too_large` | App or Runtime endpoint | A transfer chunk exceeds the chunk limit. | Treat the transfer as failed. |
| `transfer.invalid_completion` | App or Runtime endpoint | `transfer.complete` was malformed or did not match the active transfer. | Treat the transfer as failed. |
| `transfer.byte_count_mismatch` | App or Runtime endpoint | Completed bytes did not match declared size. | Treat the transfer as failed. |
| `transfer.missing_completion` | App or Runtime endpoint | The transfer socket closed before `transfer.complete`. | Treat the transfer as failed. |
| `transfer.failed` | App or Runtime endpoint | Transfer failed for a reason not represented by a more specific transfer code. | Treat the transfer as failed. |
| `runtime.transfer.unknown` | App or Runtime endpoint | A Runtime-originated transfer acknowledgement referenced an unknown transfer. | Treat the acknowledgement as rejected. |
| `runtime.transfer.wrong_mode` | App or Runtime endpoint | A Runtime-originated transfer event was sent on an incompatible transfer mode. | Treat the transfer as failed. |
| `runtime.transfer.missing_file` | Runtime endpoint | A Runtime-originated artifact file was no longer available. | Treat the transfer as failed. |
| `runtime.transfer.invalid_chunk` | App or Runtime endpoint | A Runtime-originated transfer socket received an invalid chunk or control frame. | Treat the transfer as failed. |
| `runtime.transfer.file_too_large` | App or Runtime endpoint | A Runtime-originated artifact exceeds limits. | Treat the transfer as failed. |
| `runtime.transfer.size_mismatch` | App or Runtime endpoint | Downloaded or sent artifact bytes did not match declared size. | Treat the transfer as failed. |
| `runtime.transfer.timeout` | App or Runtime endpoint | Runtime-originated artifact transfer timed out. | Treat the transfer as failed. |
| `runtime.transfer.failed` | App or Runtime endpoint | Runtime-originated artifact transfer failed for a reason not represented by a more specific code. | Treat the transfer as failed. |

### `ping`

Direction: any endpoint to Runtime when using protocol-level heartbeat.

Required fields:

- `type`: `"ping"`
- `protocol_version`: `"1"`

Runtime endpoints MUST respond locally and MUST NOT forward this event.

### `pong`

Direction: Runtime to endpoint.

Required fields:

- `type`: `"pong"`
- `protocol_version`: `"1"`

### `endpoint.policy`

Direction: Runtime endpoint to App or other connected endpoint.

`endpoint.policy` advertises endpoint-enforced protocol message limits. The endpoint always enforces its configured policy.

Required fields:

- `type`: `"endpoint.policy"`
- `protocol_version`: `"1"`
- `payload.max_message_bytes`: positive integer byte limit

Semantics:

- `max_message_bytes` is the maximum UTF-8 encoded protocol message size.
- The limit applies to every protocol message/event sent or received through the endpoint.
- The limit applies to text, JSON, semantic blocks, and metadata events.
- Transfer control events are subject to `max_message_bytes`; file chunks on the separate transfer channel are subject to transfer limits instead.
- Binary/object attachment transport beyond v1 transfer is not defined in v1, and any protocol event that references attachments is still subject to this limit.
- The endpoint always enforces the limit.
- The App MUST enforce locally once policy is learned.
- Endpoints MAY configure their own limits and advertise them.
- `max_message_bytes` MUST be at least `4096` and MUST NOT exceed `1048576` for the main protocol socket in v1.

### `transfer.request`

Direction: App to endpoint, or Runtime to endpoint for the opposite direction.

`transfer.request` asks the endpoint to allocate a separate transfer channel for one file.

Required fields:

- `type`: `"transfer.request"`
- `protocol_version`: `"1"`
- `conversation_id`: string
- `payload.mime_type`: one of `image/jpeg`, `image/png`, or `application/pdf`
- `payload.size_bytes`: declared file size in bytes

Common fields:

- `payload.filename`: sender-provided file name
- `payload.direction`: `"app_to_runtime"` or `"runtime_to_app"`

The endpoint must reject unsupported MIME types and files larger than `10485760` bytes.

Malformed `transfer.request` payloads, including unsupported MIME type, non-positive size, invalid optional filename type, or invalid direction value, must fail with `protocol.invalid_payload` on the main protocol socket.

### `transfer.ready`

Direction: endpoint to transfer requester.

`transfer.ready` approves a transfer request and returns the separate transfer channel URL.

Required fields:

- `type`: `"transfer.ready"`
- `protocol_version`: `"1"`
- `conversation_id`: string
- `payload.transfer_id`: opaque transfer ID
- `payload.transfer_url`: WebSocket URL for the separate transfer channel
- `payload.max_file_bytes`: `10485760`
- `payload.max_chunk_bytes`: `1048576`

Common fields:

- `payload.expires_at`: optional expiration timestamp for opening the transfer channel

Malformed `transfer.ready` payloads, including a missing transfer ID or invalid transfer URL, must fail with `protocol.invalid_payload` on the main protocol socket.

### `transfer.chunk.ack`

Direction: endpoint to uploader on the separate transfer WebSocket only.

`transfer.chunk.ack` confirms that the endpoint fully received and wrote one transfer chunk. Uploaders must wait for this acknowledgement before sending the next chunk.

Required fields:

- `type`: `"transfer.chunk.ack"`
- `protocol_version`: `"1"`
- `conversation_id`: string
- `payload.transfer_id`: opaque transfer ID from `transfer.ready`
- `payload.received_bytes`: total bytes received so far

### `transfer.completed`

Direction: endpoint to App and/or Runtime.

`transfer.completed` reports that the endpoint received and delivered, forwarded, or made available the complete transfer.

Required fields:

- `type`: `"transfer.completed"`
- `protocol_version`: `"1"`
- `conversation_id`: string
- `payload.transfer_id`: opaque transfer ID
- `payload.size_bytes`: received file size in bytes

Common fields:

- `payload.mime_type`: transferred MIME type

Malformed `transfer.completed` payloads, including a missing transfer ID or non-positive/non-integer size, must fail with `protocol.invalid_payload` on the main protocol socket.

### `transfer.complete`

Direction: uploader to endpoint on the separate transfer WebSocket only.

`transfer.complete` is a transfer-socket control frame sent after all binary chunks. Uploaders must send this frame and keep the transfer socket open until the endpoint acknowledges with `transfer.completed` or `transfer.failed`. Endpoint implementations must not rely on WebSocket close timing to determine whether an upload completed.

Required fields:

- `type`: `"transfer.complete"`
- `protocol_version`: `"1"`
- `conversation_id`: string
- `payload.transfer_id`: opaque transfer ID from `transfer.ready`
- `payload.size_bytes`: total byte count sent

After receiving `transfer.complete`, the endpoint validates byte count and transfer identity, sends `transfer.completed` or `transfer.failed` on the transfer socket, and also emits the same completion/failure event on the main protocol socket.

### `transfer.failed`

Direction: endpoint to App and/or Runtime.

`transfer.failed` reports rejection, timeout, chunk limit failure, delivery failure, or other transfer failure.

Required fields:

- `type`: `"transfer.failed"`
- `protocol_version`: `"1"`
- `conversation_id`: string
- `payload.message`: human-readable failure
- `payload.code`: machine-readable failure code

Common fields:

- `payload.transfer_id`: opaque transfer ID. This field is optional because some failures happen before a transfer ID is allocated.

Malformed `transfer.failed` payloads, including empty `code` or `message`, must fail with `protocol.invalid_payload` on the main protocol socket.

## 12. Capability And Identity Events

### `app.capabilities`

Direction: App to Runtime.

Apps MUST advertise rendering and interaction capabilities after successful Runtime connection so Runtimes can adapt output instead of guessing what the App can present.

Required payload fields:

- `content_types`: array of supported content types, such as `"text/plain"`, `"text/markdown"`, `"text/code"`, `"text/log"`, `"application/json"`, `"application/yaml"`, `"application/vnd.ripdock.activity+json"`, and `"application/vnd.ripdock.artifact+json"`.
- `features.streaming`: whether the App can present streaming updates.
- `features.semantic_blocks`: whether the App can present semantic content blocks.
- `features.attachments`: whether the App can present attachment descriptors.
- `features.generated_artifacts`: whether the App can present generated artifact metadata.
- `features.runtime_transfers`: whether the App can complete Runtime-to-App artifact transfers.
- `features.artifact_http_downloads`: whether the App can download Runtime-originated artifact bytes over HTTPS.
- `features.artifact_ack`: whether the App sends Runtime artifact transfer completion/failure acknowledgements.
- `features.inline_images`: whether the App can present inline images.
- `features.tool_cards`: whether the App can present Runtime tool progress cards.
- `features.html`: whether the App can present HTML.
- `client_capabilities.content_rendering.plain_text`: whether the App can render plain text.
- `client_capabilities.content_rendering.basic_markdown`: whether the App can render basic markdown.
- `client_capabilities.content_rendering.rich_text_v1`: whether the App can render RipDock Rich Text v1.
- `client_capabilities.content_rendering.json`: whether the App can render JSON text.
- `client_capabilities.content_rendering.yaml`: whether the App can render YAML text.
- `client_capabilities.content_rendering.code_blocks`: whether the App can render fenced code blocks.
- `client_capabilities.content_rendering.external_links`: whether the App can open URLs externally.
- `client_capabilities.rich_text_v1.bold`: whether Rich Text v1 bold is supported.
- `client_capabilities.rich_text_v1.italic`: whether Rich Text v1 italic is supported.
- `client_capabilities.rich_text_v1.underline`: whether Rich Text v1 underline is supported.
- `client_capabilities.rich_text_v1.inline_code`: whether Rich Text v1 inline code is supported.
- `client_capabilities.rich_text_v1.code_blocks`: whether Rich Text v1 fenced code blocks are supported.
- `client_capabilities.rich_text_v1.lists`: whether Rich Text v1 bullet and numbered lists are supported.
- `client_capabilities.rich_text_v1.quotes`: whether Rich Text v1 blockquotes are supported.

OPTIONAL payload fields:

- `app_metadata.selected_runtime_type`: selected Runtime type recorded by the App.

`app.capabilities` describes UI/rendering features: what the App can render or present. It is separate from `runtime.capabilities`, which describes Runtime behavior.

Runtime endpoints MUST process `app.capabilities` without forwarding.

### `runtime.identity`

Direction: Runtime to App.

Required fields:

- `runtime_id`: stable Runtime identifier.
- `display_name`: display name for the Runtime.
- `runtime_public_key`: Runtime P-256 JWK public key object used for Runtime identity validation.
- `runtime_public_key_fingerprint`: stable fingerprint of the Runtime public key. This MUST equal `runtime_public_key.key_id`.
- `runtime_identity_created_at`: timestamp when the Runtime identity key was created.
- `runtime_identity`: typed RuntimeIdentity metadata.

Additional fields:

- `runtime_type`: Runtime-owned type string. This is display/configuration metadata and MUST NOT replace cryptographic Runtime identity.
- `runtime_version`: Runtime version string.
- `runtime_metadata`: typed RuntimeMetadata for the Runtime.
- `icon`: Runtime-owned emoji icon.
- `accent_color`: Runtime-owned accent color.
- `background_color`: Runtime-owned background color.

RuntimeIdentity `runtimeId` MUST be a stable, Runtime-owned identifier.
RuntimeIdentity `publicKey` MUST be a P-256 JWK public key object. RuntimeIdentity `publicKeyFingerprint` MUST equal `publicKey.key_id`.

### `runtime.status`

Direction: Runtime to App.

Required fields:

- `type`: `"runtime.status"`
- `protocol_version`: `"1"`
- `status`: Runtime-owned status string.

Common fields:

- `message`: diagnostic status text. Apps MUST NOT display this value verbatim in normal user-facing error UI.

### `runtime.capabilities`

Direction: Runtime to App.

Required boolean fields:

- `streaming`
- `tools`
- `interrupt`
- `multimodal`
- `attachments`
- `background_tasks`
- `settings`: whether the Runtime can advertise Runtime-specific settings with `runtime.settings`.
- `agents`: whether the Runtime advertises Agent choices with `runtime.agents`.
- `agent_settings`: whether the Runtime supports Agent-specific settings with `agent.settings.update`.
- `slash_commands`: whether the Runtime advertises Runtime-owned slash commands with `runtime.slash_commands`.
- `generated_artifacts`: whether the Runtime can create generated artifacts.
- `runtime_transfers`: whether the Runtime can deliver generated artifacts.
- `artifact_http_downloads`: whether Runtime-to-App artifacts are delivered by App-initiated HTTP download.
- `artifact_ack`: whether Runtime-to-App artifact delivery requires App completion/failure acknowledgement.

Capability events declare protocol-visible Runtime behavior. They do not define tool, model, memory, or background task internals.

Capability distinction:

- `app.capabilities`: App UI/rendering and interaction support.
- `runtime.capabilities`: Runtime behavior and available Runtime-side features.

### Runtime-Aware Settings

Runtime-aware settings let Apps present general App settings separately from Runtime-specific settings.

Architecture:

- The user selects a Runtime type before Pairing.
- The selected Runtime type is represented as `selected_runtime_type` in App metadata or Session metadata.
- General settings belong to the App and are not protocol-defined Runtime settings.
- Runtime settings belong to the Runtime and are advertised with `runtime.settings`.
- Runtime-specific settings are isolated by `runtime_id`.
- Apps MUST show only settings relevant to the selected Runtime type and active `runtime_id`.
- Runtimes MAY advertise additional settings dynamically by sending a new `runtime.settings` event.
- Unknown Runtime setting definition fields are invalid in `runtime.settings`.
- Runtime setting definition `type` values outside `boolean`, `string`, `number`, `enum`, and `action` are schema-invalid.
- Unknown Runtime setting update keys sent by the App are invalid and MUST be rejected with `protocol.invalid_payload`.

Runtime-aware settings are protocol metadata in v1. The protocol does not define UI controls, persistence storage, setting sync behavior, Runtime internals, or action behavior.

Supported setting definition types:

- `boolean`
- `string`
- `number`
- `enum`
- `action`

Setting definition fields:

- `key`: stable Runtime-owned setting key.
- `label`: human-readable label.
- `description`: OPTIONAL human-readable description.
- `type`: setting type.
- `default`: OPTIONAL default value for boolean, string, number, or enum settings.
- `category`: OPTIONAL high-level grouping.
- `section`: OPTIONAL lower-level grouping.
- `developer_only`: whether the setting MUST be shown only in developer-oriented settings surfaces.
- `enum_values`: REQUIRED for `enum` settings; each value MAY be a string or an object with `value`, `label`, and OPTIONAL `description`.

Action settings represent user-invoked Runtime requests. They are not persistent values.

### `runtime.settings`

Direction: Runtime to App.

`runtime.settings` advertises Runtime-specific setting definitions for the active Runtime. It MAY be sent after `runtime.identity`, after `runtime.capabilities`, or later when Runtime capabilities change.

Required fields:

- `type`: `"runtime.settings"`
- `protocol_version`: `"1"`
- `runtime_id`: Runtime settings isolation key.
- `settings`: array of setting definitions.

Common fields:

- `runtime_type`: Runtime-owned type string.
- `display_name`: display name for the Runtime settings group

### `runtime.settings.update`

Direction: App to Runtime.

`runtime.settings.update` sends Runtime-specific setting value changes or action requests to the Runtime identified by `runtime_id`.

Required fields:

- `type`: `"runtime.settings.update"`
- `protocol_version`: `"1"`
- `runtime_id`: Runtime settings isolation key.
- `settings`: object keyed by setting key; or
- `actions`: array of action setting keys.

The App MUST send only settings for the active selected Runtime. `settings` and `actions` MUST reference setting keys advertised by the active Runtime. The Runtime MUST reject unknown, unadvertised, or unsupported setting keys and action keys with `protocol.invalid_payload`.

Malformed `runtime.settings.update` events, including missing `runtime_id`, an empty or non-object `settings` value, malformed setting keys, an empty `actions` array, or non-string `actions` entries, must fail with `protocol.invalid_payload`.

### Agent-Aware Chat

Agent-aware chat makes the Agent the App's user-facing chat unit. Pairing and trust remain Runtime-level concepts. Chat identity, display metadata, local ordering, conversation history, drafts, and App-facing display settings belong to Agents.

Architecture:

- The App pairs with a Runtime once.
- The Runtime advertises available Agents with `runtime.agents`.
- The App automatically adds advertised Agents, and MAY let the user hide or show Agents locally.
- The App's primary chat chooser lists Agents across paired Runtimes.
- Agent identity is scoped to a Runtime. Different Runtimes may advertise the same `agent_id`; Apps must key local Agent records by parent Runtime record plus `agent_id`.
- Agent themes are Agent-owned. If Agent theme fields are missing, Apps use App defaults rather than Runtime theme values.
- Runtime Management ordering and Agent chooser ordering are separate App-local preferences.
- Agent settings belong to Agents and are updated with `agent.settings.update`.
- Runtime settings remain available for Runtime-level behavior only.

### `runtime.agents`

Direction: Runtime to App.

`runtime.agents` advertises the complete Agent list for one trusted Runtime. It MUST NOT be sent before Pairing and Session resume have established Device trust. It MAY be sent after `runtime.identity`, after `runtime.capabilities`, or later when Agent metadata changes on an authorized App Session.

Required fields:

- `type`: `"runtime.agents"`
- `protocol_version`: `"1"`
- `runtime_id`: stable Runtime identity string.
- `agents`: array of Agent definitions.

Agent definition fields:

- `agent_id`: stable Runtime-scoped Agent identity.
- `display_name`: user-facing Agent name.
- `description`: OPTIONAL user-facing description.
- `icon`: OPTIONAL Runtime-owned emoji icon. Non-emoji icon names, platform symbol names, image tokens, URLs, and asset identifiers are invalid.
- `accent_color`: OPTIONAL CSS-style color string.
- `background_color`: OPTIONAL CSS-style color string.
- `sort_order`: OPTIONAL Runtime-owned order hint.
- `settings`: OPTIONAL array of Agent setting definitions.

Agent setting definitions use the same strict setting definition shape as Runtime-aware settings: `key`, `label`, and `type` are required; `enum_values` is required when `type` is `enum`; unknown setting definition fields are invalid.

Apps must not infer Agents from Runtime setting enum values. Runtime dashboards or other Runtime-owned management surfaces are responsible for creating Agents and their display metadata.

Runtime-owned management surfaces MAY disable Agents. Disabled Agents must not be included in `runtime.agents`, metadata discovery payloads intended for Apps, or any App-visible Agent chooser. A paired Runtime with zero enabled Agents is valid. Runtime endpoints MUST reject App messages that target missing, disabled, or unadvertised Agents with `agent.unavailable`.

### `runtime.slash_commands`

Direction: Runtime to App.

`runtime.slash_commands` advertises Runtime-owned chat slash commands for one trusted Runtime. It MUST NOT be sent before Pairing and Session resume have established Device trust. It MAY be sent after `runtime.identity`, after `runtime.capabilities`, after `runtime.agents`, or later when Runtime command availability changes on an authorized App Session.

Slash commands are per-Runtime. Apps MUST key advertised command catalogs by `runtime_id`. Apps MUST NOT infer slash commands from `runtime_type`, local Runtime names, command help text, Agent metadata, or hardcoded Runtime-specific lists.

Apps use `runtime.slash_commands` for command discovery and composer assistance only. Selecting or typing a slash command sends ordinary `message.create` content after a Runtime-owned `conversation_id` exists. Runtime endpoints own command execution, authorization, confirmation, validation, and error behavior.

Required fields:

- `type`: `"runtime.slash_commands"`
- `protocol_version`: `"1"`
- `runtime_id`: stable Runtime identity string.
- `commands`: array of slash command definitions.

Slash command definition fields:

- `name`: stable Runtime-owned command key without a leading slash.
- `display`: user-facing slash command token, including the leading slash.
- `description`: short user-facing description.
- `argument_hint`: OPTIONAL argument usage hint.
- `category`: OPTIONAL Runtime-owned grouping label.
- `aliases`: OPTIONAL alternate command keys without leading slashes.

Runtimes SHOULD advertise only commands intended for the App chat surface. Runtime-internal QA commands, developer-only commands, App-owned profile/conversation controls, and platform-specific CLI/TUI controls SHOULD NOT be advertised. A Runtime that supports no App-visible slash commands MAY advertise an empty `commands` array.

### `agent.settings.update`

Direction: App to Runtime.

`agent.settings.update` sends Agent-specific setting value changes or action requests to the Runtime identified by `runtime_id` and Agent identified by `agent_id`.

Required fields:

- `type`: `"agent.settings.update"`
- `protocol_version`: `"1"`
- `runtime_id`: stable Runtime identity string.
- `agent_id`: Runtime-scoped Agent identity string.
- `settings`: object keyed by setting key; or
- `actions`: array of action setting keys.

The App MUST send only settings for the active Agent. The Runtime MUST reject missing, disabled, unadvertised, or unknown `agent_id` values with `agent.unavailable`. `settings` and `actions` MUST reference setting keys advertised by that Agent. The Runtime MUST reject unknown, unadvertised, or unsupported Agent setting keys and action keys with `protocol.invalid_payload`. The resumed Device must have the `agent:settings:update` authorization scope.

Malformed `agent.settings.update` events, including missing `runtime_id`, missing `agent_id`, an empty or non-object `settings` value, malformed setting keys, an empty `actions` array, or non-string `actions` entries, must fail with `protocol.invalid_payload`.

## 13. Authorization Scopes

Signed `session.resume` authenticates the paired Device. It does not grant every action by itself. Runtime endpoints must authorize privileged App messages against scopes bound to the trusted Device and Session.

Reference v1 scopes:

- `message:create`: create conversations with `conversation.create` and send `message.create` to an allowed Agent.
- `message:cancel`: cancel or interrupt an in-flight message.
- `conversation:list`: list durable Runtime-owned conversation summaries for an allowed Agent.
- `conversation:sync`: sync durable Runtime-owned conversation messages for an allowed Agent.
- `conversation:delete`: delete durable Runtime-owned conversation state for an allowed Agent.
- `conversation:title:generate`: generate and persist Runtime-owned conversation title metadata for an allowed Agent.
- `agent:settings:update`: send `agent.settings.update`.
- `runtime:settings:update`: send `runtime.settings.update`.
- `transfer:app_to_runtime`: request or complete App-to-Runtime file transfer control events.
- `transfer:runtime_to_app:ack`: acknowledge Runtime-to-App artifact transfer completion or failure.

Runtime endpoints may define narrower scopes, such as per-Agent allow lists, but must fail closed when a privileged message lacks an applicable scope. `*` may be used only by trusted local/dev endpoints or explicitly configured admin Devices. Pairing/admin HTTP actions are not App Session privileges in v1 and must not be unlocked merely by a resumed chat Session.

`session.resumed` may include `payload.authorization_scopes` to tell the App which scopes are active for this attachment. Apps must treat the field as informational; Runtime enforcement is authoritative.

## 14. Malformed Input Handling

Runtime endpoints must fail closed for malformed main-socket input without throwing implementation exceptions or leaking sensitive state.

Required behavior:

- Binary frames on the main protocol socket are invalid. Endpoints MUST send `transport.invalid_message` and close the socket with WebSocket close code `1003`.
- Invalid JSON must return a generic `transport.invalid_json` error and keep the connection policy-defined.
- JSON values that are not objects must return `transport.invalid_message`.
- JSON objects without a non-empty string `type` must return `transport.missing_type`.
- Messages larger than endpoint policy must return `message.too_large` and close with a too-large close code.
- Privileged messages before signed resume must return `session.resume_required`.
- Privileged messages after resume but without required Device authorization scope must return `authorization.denied`.
- Authorized privileged messages with malformed required fields, wrong field types, invalid nested payload objects, invalid transfer URLs, oversized declared transfer sizes, or references to unknown/incomplete transfers must return `protocol.invalid_payload` and must not partially execute.
- Unknown events after successful resume must be rejected with `protocol.invalid_payload`.
- Protocol logs must redact Session IDs, tokens, signatures, nonces, Pairing codes, authorization material, transfer URLs, download URLs, and private key material.

### `session.resume`

Direction: App to Runtime endpoint.

`session.resume` requests binding a new WebSocket connection to an existing durable Session. App resume is a proof-of-possession operation: the App must sign the resume request with the paired Device private key, and the endpoint must verify the signature with the Device public key stored during Pairing before accepting privileged App messages.

Required fields:

- `type`: `"session.resume"`
- `protocol_version`: `"1"`
- `session_id`: durable Session ID to resume.
- `runtime_id`: persistent Runtime identity expected by the App.
- `app_device_id`: persistent App Device identity.
- `resume_signature`: signature object proving control of the paired Device private key.

- `last_event_id`: optional last event observed by the reconnecting side.
- `conversation_id`: optional conversation scope requested for restore.

`resume_signature` fields:

- `alg`: signing algorithm. The required v1 value is `"ES256"`.
- `key_id`: identifier for the paired Device public key. This MUST equal the paired `DeviceIdentity.publicKey.key_id`.
- `nonce`: endpoint-unique random value generated by the App for this resume attempt.
- `timestamp`: UTC timestamp for this resume attempt.
- `route`: route context for this WebSocket. In v1 this MUST be the exact App Session route path that received the WebSocket. For a bare Runtime host this is `"/ripdock/app"`. For deployments mounted under a base path, this is `"<base-path>/ripdock/app"`. Query strings and fragments MUST NOT be included.
- `signature`: base64url-encoded raw ECDSA P-256 signature bytes, encoded as `r || s`.

The v1 signing algorithm is P-256 ECDSA with SHA-256, identified as `ES256`. Device private keys MUST be generated as non-exportable, hardware-backed keys on platforms that provide hardware-backed key storage. Public keys exchanged during Pairing MUST use the strict P-256 JWK public key object defined above. V1 does not allow alternate public key encodings.

The signed material is the canonical JSON representation of this object:

```json
{
  "app_device_id": "<app_device_id>",
  "key_id": "<resume_signature.key_id>",
  "nonce": "<resume_signature.nonce>",
  "protocol_version": "1",
  "route": "<resume_signature.route>",
  "runtime_id": "<runtime_id>",
  "session_id": "<session_id>",
  "timestamp": "<resume_signature.timestamp>",
  "type": "session.resume"
}
```

Canonical JSON means RFC 8785 JSON Canonicalization Scheme encoded as UTF-8. V1 does not allow alternate canonicalization schemes.

Resume verification rules:

- The endpoint must reject `session.resume` when `resume_signature` is missing, malformed, made with an unsupported algorithm, or invalid for the signed material.
- The endpoint must reject `session.resume` when `session_id` does not belong to the claimed `runtime_id` and `app_device_id`.
- The endpoint must reject `session.resume` when the Device is unknown, unpaired, pending, rejected, revoked, expired, disabled, or not authorized for the Session.
- The endpoint must reject `session.resume` when the signed `runtime_id` does not identify the Runtime expected for the Session.
- The endpoint must reject `session.resume` when the signed `route` does not match the route context that received the WebSocket.
- The endpoint must reject `session.resume` when the Session is past its idle timeout or absolute lifetime.
- The endpoint must reject stale timestamps and reused nonces according to endpoint policy. The timestamp acceptance window MUST NOT exceed five minutes. Nonce replay state MUST be retained for at least the timestamp acceptance window.
- Invalid signatures must not consume nonce replay state. A failed attacker-supplied signature must not be able to burn a legitimate App nonce before proof-of-possession succeeds.
- After successful signed resume, the endpoint MUST refresh Session `lastSeen` metadata and MAY rotate the Session ID. If it rotates, it must return the new ID in `session.resumed`.
- The endpoint must reject `conversation.create`, `message.create`, `agent.settings.update`, transfer requests, and other privileged App messages until signed resume verification succeeds.
- After signed resume succeeds, the endpoint must still reject privileged messages that the resumed Device is not authorized to perform.
- If a Device is revoked, the endpoint must invalidate Sessions bound to that Device. If the Device has an already resumed App socket, the endpoint MUST reject subsequent privileged messages from that socket, send `session.expired` with a generic re-Pairing reason, and close the socket.
- Resume failure errors must not reveal whether a specific `session_id`, Device, nonce, or key ID exists.

### `session.resumed`

Direction: Runtime endpoint to App or Runtime.

`session.resumed` confirms that the current WebSocket connection is attached to the durable Session.

Required fields:

- `type`: `"session.resumed"`
- `protocol_version`: `"1"`
- `session_id`: resumed Session ID.

Common fields:

- `app_device_id`: persistent App Device identity.
- `runtime_id`: persistent Runtime identity.
- `conversation_ids`: optional list of conversations available for continuity.
- `resumed_at`: resume timestamp.

### `session.expired`

Direction: Runtime endpoint to App or Runtime.

`session.expired` reports that a Session cannot be resumed. The App may need to re-pair or create a new Session.

Required fields:

- `type`: `"session.expired"`
- `protocol_version`: `"1"`
- `session_id`: expired Session ID.
- `code`: `"session.expired"`

Common fields:

- `reason`: human-readable reason.
- `code`: machine-readable reason code.
- `expired_at`: expiration timestamp.

### `session.disconnected`

Direction: Runtime endpoint to App or Runtime.

`session.disconnected` reports that one side of a durable Session is temporarily disconnected while the Session remains recoverable.

Required fields:

- `type`: `"session.disconnected"`
- `protocol_version`: `"1"`
- `session_id`: affected Session ID.

Common fields:

- `role`: `"app"` or `"runtime"`.
- `reason`: human-readable reason.
- `disconnected_at`: disconnect timestamp.
- `recoverable`: whether the Session is expected to be resumable.

### Generated Artifacts

Generated artifacts are Runtime-created files or file-like outputs that can be delivered to the App and associated with assistant messages.

Generated artifact support defines metadata and transport events only. It does not define artifact generation, rendering, preview generation, file persistence, cloud object storage, document editing, or automatic file execution.

Directionality:

- App to Runtime file transfers use `transfer.request`, `transfer.ready`, `transfer.completed`, and `transfer.failed`.
- Runtime to App generated artifacts use `runtime.artifact.created` and `runtime.transfer.*`.

Generated artifact metadata fields:

- `artifact_id`: Runtime-created artifact identifier.
- `transfer_id`: transfer identifier used to deliver artifact bytes.
- `filename`: Runtime-provided filename.
- `mime_type`: declared MIME type.
- `size_bytes`: declared artifact size.
- `created_at`: artifact creation timestamp.
- `description`: OPTIONAL human-readable artifact description.
- `source_runtime_id`: Runtime that created the artifact.
- `source_message_id`: assistant message that produced or owns the artifact.

Attachment association:

- A generated artifact MAY attach to an assistant message by setting `message_id` and/or `source_message_id` to the assistant message ID.
- Apps MUST present generated artifacts as message attachments when the referenced assistant message is present.
- Apps must tolerate artifacts whose source message is missing, delayed, or unknown.

Runtime responsibilities:

- Runtime endpoints remain transport-only for generated artifacts.
- Runtime endpoints MAY enforce advertised endpoint message and chunk size limits.
- Runtime endpoints MUST NOT inspect, execute, transform, render, or persist artifact contents beyond what is required to route the transfer.

Security expectations:

- Runtime-generated artifacts are untrusted files from the App perspective.
- Apps must not automatically execute generated artifacts.
- Apps MUST validate declared MIME type, size, filename, and transfer metadata before presenting or storing artifacts.
- Apps MUST use platform-safe open/share flows and avoid privileged file handling.
- MIME validation is REQUIRED; mismatches MUST fail or degrade safely.

### `runtime.artifact.created`

Direction: Runtime to App.

`runtime.artifact.created` announces metadata for a Runtime-generated artifact. For Runtime-to-App delivery, the byte delivery mechanism is App-initiated HTTP download using the `download_url` announced in `runtime.transfer.request`.

Required fields:

- `type`: `"runtime.artifact.created"`
- `protocol_version`: `"1"`
- `artifact_id`: artifact identifier.
- `filename`: Runtime-provided filename.
- `mime_type`: MIME type.
- `size_bytes`: artifact size. V1 maximum is `10485760`.

Common fields:

- `conversation_id`: conversation scope.
- `message_id`: optional assistant message ID. If supplied, the artifact MUST attach to that assistant message.
- `transfer_id`: transfer identifier for artifact bytes.
- `created_at`: artifact creation timestamp.
- `description`: artifact description.
- `source_runtime_id`: Runtime that created the artifact.
- `source_message_id`: assistant message that produced or owns the artifact.
- `sha256`: lowercase hex SHA-256 digest of the artifact bytes.
- `download_url`: HTTPS URL the App uses to download the artifact bytes.
- `expires_at`: optional expiration timestamp for `download_url`.

### `runtime.transfer.request`

Direction: Runtime to App.

`runtime.transfer.request` starts Runtime-originated artifact delivery. The request points the App at an HTTPS artifact download URL. The App downloads the bytes, validates declared size and SHA-256 digest, then acknowledges success or failure on the main protocol socket.

Required fields:

- `type`: `"runtime.transfer.request"`
- `protocol_version`: `"1"`
- `payload.transfer_id`: transfer identifier.
- `payload.artifact_id`: generated artifact identifier.
- `payload.filename`: Runtime-provided filename.
- `payload.mime_type`: declared MIME type.
- `payload.size_bytes`: declared total size. V1 maximum is `10485760`.
- `payload.download_url`: HTTPS URL for artifact bytes.
- `payload.sha256`: lowercase hex SHA-256 digest of artifact bytes.

Common fields:

- `conversation_id`: conversation scope.
- `message_id`: optional assistant message ID. If supplied, the artifact MUST attach to that assistant message.
- `payload.direction`: `"runtime_to_app"`.
- `payload.expires_at`: optional expiration timestamp for `download_url`.
- `payload.source_runtime_id`: Runtime that created the artifact.
- `payload.source_message_id`: assistant message that produced or owns the artifact.

### `runtime.transfer.completed`

Direction: App to Runtime for Runtime-to-App artifact delivery acknowledgement.

`runtime.transfer.completed` acknowledges that the App downloaded, validated, and stored a Runtime-generated artifact. The Runtime must not treat a Runtime-to-App artifact transfer as complete until this acknowledgement is received.

Required fields:

- `type`: `"runtime.transfer.completed"`
- `protocol_version`: `"1"`
- `payload.transfer_id`: transfer identifier.
- `payload.artifact_id`: generated artifact identifier.
- `payload.size_bytes`: downloaded artifact size. V1 maximum is `10485760`.
- `payload.sha256`: lowercase hex SHA-256 digest observed by the App.

### `runtime.transfer.failed`

Direction: Runtime to App or endpoint to App/Runtime.

`runtime.transfer.failed` reports rejection, validation failure, timeout, interruption, download failure, or other Runtime-originated transfer failure. It may be sent by the Runtime to announce setup failure, or by the App to acknowledge failed download/validation.

Required fields:

- `type`: `"runtime.transfer.failed"`
- `protocol_version`: `"1"`
- `payload.transfer_id`: transfer identifier.
- `payload.artifact_id`: generated artifact identifier.
- `payload.message`: human-readable failure.
- `payload.code`: machine-readable failure code.

## 15. Pairing

Runtime Pairing:

1. Runtime creates a Pairing code and, when a device-facing Runtime URL is available, a Pairing QR payload.
2. Runtime sends `pairing.created`.
3. Runtime displays the code or QR payload.
4. App opens the Runtime Pairing WebSocket route for the Pairing code.
5. App and Runtime identities are associated into a durable trust relationship.
6. Runtime sends `pairing.connected`.
7. App stores the Runtime base URL, `session_id`, persistent identity, and Device key material.
8. Later reconnects use the stored Runtime, Session, Device identity, and signed `session.resume`.

Pairing is long-lived trust establishment. It is not only a temporary WebSocket Session. Pairing normally happens once per trusted App Device and Runtime relationship.

Pairing codes must expire according to Runtime policy. Pending
Device records must include an expiry. Runtime policy must prevent revoked
Devices from silently re-Pairing and must prevent recently rejected Devices from
immediately retrying as a new pending Device without admin action or rejection
expiry.

Direct Runtime Pairing follows the same Session rule: once a Runtime reports `trustState: "trusted"` and returns a durable `session_id`, the App opens chat at the Runtime App Session WebSocket route and sends `session.resume` with that `session_id`. If a trusted status response omits `session_id`, the Runtime is trusted but not chat-ready.

Pairing QR payloads must conform to `pairing-qr-payload.schema.json`.

Pairing QR security:

- The QR payload is not authority and must never grant trust by itself.
- The App must open the `runtime_url` App Pairing WebSocket route and complete Pairing with the `pairing_code`.
- If Runtime identity fields are present, the App must verify them against the fetched Runtime identity before proceeding.
- Runtime trust is established only after Runtime approval for the claiming `DeviceIdentity`.
- The Runtime must enforce Pairing code TTL server-side.

Pairing WebSocket URLs must use `wss://`. `ws://` Runtime URLs are unsupported.

QR semantics:

- A QR code carries a Pairing payload, not credentials by definition.
- The App MUST validate the payload shape before opening a WebSocket.
- Pairing payloads MAY include the Runtime P-256 JWK public key object for trust establishment.
- `runtime_url` is a `wss://` App Pairing WebSocket route.
- `runtime_url` is not a Runtime base URL and is not the chat socket. Apps use `/ripdock/app` and send `session.resume` with the durable per-Runtime `session_id` after trust succeeds.
- `runtime_url` is a connection location, not the Runtime's trusted identity.
- `runtime_identity` is the cryptographic Runtime identity. If supplied, the App must compare it during Pairing and reconnect.

## 16. Resume Lifecycle

1. App and Runtime complete Pairing once and store persistent identity/trust metadata.
2. A WebSocket connection drops because of a Runtime deploy, mobile reconnect, Runtime restart, temporary network outage, or normal transport close.
3. The durable Session remains recoverable while endpoint policy allows it.
4. App opens a new App Session WebSocket connection.
5. App sends signed `session.resume` with the same `session_id`, persistent `app_device_id`, expected `runtime_id`, route context, nonce, timestamp, key ID, and Device signature.
6. Runtime endpoint validates the resume request, verifies the Device signature, checks Session ownership, checks Runtime identity, checks route binding, and rejects stale or replayed nonces.
7. Runtime endpoint sends `session.resumed`, or `session.expired` when the Session can no longer be resumed.
8. Message flow continues on the new WebSocket connection. If the Runtime returns `conversation_ids`, the App uses them for conversation continuity.

Security model:

- `session_id` is secret-bearing but is not sufficient for App resume without a valid Device signature.
- The App must validate Runtime identity before trusting the resumed connection.
- The Runtime or Runtime endpoint must validate the paired Device identity before accepting privileged App messages.
- Implementations must treat Session IDs as secrets and rotate, revoke, or expire them according to endpoint policy. Endpoint policy MUST include idle timeout, absolute lifetime, rotation on successful resume, and immediate invalidation when the bound Device is revoked.
- Apps must store Runtime Session IDs and token material only in platform secret storage. They must not persist raw Session IDs in UserDefaults, SQLite workspace rows, artifact files, synced metadata, or logs.
- Runtime long-running work does not require the Runtime to resume a Session with the App. The App initiates reconnect and resume; after successful resume, the Runtime or Runtime endpoint MUST provide enough state for the App to reconcile current conversation and in-flight work when the Runtime supports such state.
- Protocol v1 does not define deployment rate-limit thresholds, edge provider rules, IP reputation policy, bot mitigation, or tunnel abuse controls. Operators exposing a Runtime directly or through a tunnel are responsible for deployment-level abuse protection. If an endpoint rejects traffic under local policy and emits a protocol error, the response must not reveal whether a Session, Device, nonce, key, or Pairing code exists.

## 17. Streaming Lifecycle

1. For a new conversation, App sends `conversation.create`.
2. Runtime creates a durable conversation and emits exactly one `conversation.created` event containing the new `conversation_id`.
3. App sends user content with `message.create` and the returned `conversation_id`.
4. Runtime sends the JSON object to the active Runtime side of the same Session.
5. Runtime emits zero or more `message.delta` events for append-only streaming text.
6. Runtime may emit one or more `message.block` events for complete semantic content blocks.
7. Runtime emits `message.completed` or an `error` event.
8. Runtime sends Runtime events to the App unchanged.

Ordering is WebSocket ordering within a single connection. V1 does not define multiplexed ordering across simultaneous Runtime messages. Consumers MUST use `conversation_id` and `message_id` on events that include those fields.

## 18. Transfer Lifecycle

V1 transfer supports direct App-to-Runtime upload and Runtime-to-App generated artifact download without cloud object storage.

The main protocol WebSocket remains JSON-only. App-to-Runtime upload chunks must use the separate transfer WebSocket/channel returned by `transfer.ready`. Runtime-to-App generated artifact bytes must use HTTPS download URLs and App acknowledgement.

V1 supported App-to-Runtime transfer MIME types:

- `image/jpeg`
- `image/png`
- `application/pdf`

V1 App-to-Runtime transfer limits:

- `max_file_bytes`: `10485760` bytes, or 10 MB
- `max_chunk_bytes`: `1048576` bytes, or 1 MB
- one active transfer per message
- no resumable file transfers
- uploaders must wait for `transfer.chunk.ack` after each chunk before sending the next chunk

App to Runtime file transfer flow:

1. App sends `transfer.request` over the main protocol socket.
2. Endpoint validates declared size and MIME type.
3. Endpoint returns `transfer.ready` with `transfer_id` and `transfer_url`.
4. App opens the transfer WebSocket.
5. App sends chunks over the transfer channel.
6. Endpoint sends `transfer.chunk.ack` after each chunk.
7. App sends the next chunk only after receiving the matching acknowledgement.
8. App sends `transfer.complete` over the transfer channel.
9. Endpoint validates byte count and transfer identity.
10. Endpoint sends `transfer.completed` or `transfer.failed` on the transfer channel.
11. Endpoint emits the same `transfer.completed` or `transfer.failed` on the main protocol socket.
12. App sends `message.create` referencing `transfer_id` in `transfer_ids`.

Runtime to App generated artifact flow:

1. Runtime creates a generated artifact.
2. Runtime creates a `transfer_id` and HTTPS `download_url` for the artifact.
3. Runtime emits `runtime.artifact.created` with artifact metadata, assistant message association, `transfer_id`, `download_url`, `size_bytes`, and `sha256`.
4. Runtime emits `runtime.transfer.request` with the same `transfer_id`, `download_url`, `size_bytes`, and `sha256`.
5. App downloads the artifact over HTTPS.
6. App validates declared size, MIME policy, and SHA-256 digest.
7. App sends `runtime.transfer.completed` on success, or `runtime.transfer.failed` on failure.
8. Runtime marks the artifact transfer complete or failed only after receiving the App acknowledgement.

Runtime-originated generated artifact transfers are not limited to the App-to-Runtime transfer MIME set. Apps and endpoints must validate declared MIME type and size before accepting, storing, previewing, or opening the file.

Transfer channel:

- App-to-Runtime upload uses a transfer channel separate from the main protocol socket.
- App-to-Runtime transfer channels are scoped to one `transfer_id`.
- Each chunk must be no larger than `1048576` bytes.
- App-to-Runtime total bytes must not exceed `10485760` in v1.
- Runtime-originated artifact downloads must not exceed `10485760` bytes in v1.
- The endpoint closes or fails the transfer on oversized chunks, excess total bytes, timeout, unsupported MIME type, unknown transfer ID, or duplicate active transfer.

Runtime endpoint responsibilities:

- validate declared size and MIME type,
- enforce maximum file and chunk limits,
- generate `transfer_id`,
- route App-to-Runtime chunks between App and Runtime,
- serve Runtime-to-App artifact downloads by `transfer_id`,
- require Runtime-to-App App acknowledgement before marking delivery complete,
- timeout abandoned transfers,
- avoid permanent file storage,
- avoid content inspection or transformation,
- avoid executing or rendering generated artifacts,
- avoid cloud object storage semantics.

V1 transfer does not define resumable file transfers, attachment storage APIs, binary frames on the main protocol socket, encryption beyond transport TLS, thumbnails, previews, generated artifact rendering, or automatic artifact execution.

## 19. Heartbeat Lifecycle

Heartbeat behavior exists at two levels:

- Protocol JSON heartbeat: endpoint sends `{"type":"ping","protocol_version":"1"}`, Runtime replies `{"type":"pong","protocol_version":"1"}`.
- WebSocket control-frame heartbeat: clients MAY send WebSocket pings according to endpoint policy.

Implementations MUST support JSON heartbeat and MAY also use transport-level WebSocket pings.

## 20. Reconnect Behavior

Reconnect is client-owned and transport-level WebSocket reconnect is separate from durable Session resume.

App reconnect behavior:

- Reconnect after transient disconnects while active and allowed by local policy.
- Use backoff to avoid connection storms.
- Resume through the stored endpoint location and Session ID after successful Pairing.
- Apps send signed `session.resume` with persistent Device identity, expected Runtime identity, route context, nonce, timestamp, key ID, and Device signature. 
- After successful resume, Apps MAY send `conversation.sync` for locally known Runtime Agent conversations and MUST use the last Runtime-provided sync cursor for each `runtime_id`, `agent_id`, and `conversation_id`.

Endpoints with durable Session support MUST preserve Session binding across WebSocket disconnects, Runtime restarts, mobile reconnects, and temporary network outages while the Session remains within lifecycle policy.

Runtimes must not require App clocks to be authoritative for conversation continuity. Runtime-owned cursors in `conversation.synced` are authoritative for reconnect reconciliation.

## 21. Out of Scope for v1

V1 does not define attachment storage APIs, cloud object storage semantics, resumable transfer, HTML rendering rules, markdown dialects, arbitrary styling/CSS, or thumbnail/preview generation.

## 22. Schema Entry Points

Current v1 schema entry points are grouped by transport surface:

- `event.schema.json`: complete v1 event union across main and transfer WebSocket channels.
- `main-event.schema.json`: App-to-Runtime main protocol WebSocket events.
- `transfer-event.schema.json`: dedicated transfer WebSocket JSON control events.
- `pairing-qr-payload.schema.json`: QR Pairing payload.
- `device-identity-model.schema.json`: Pairing request/status HTTP request body.
- `pairing-result.schema.json`: Pairing status/request HTTP response body.
- `runtime-identity-model.schema.json`: Runtime identity HTTP response body.
- `runtime-metadata-response.schema.json`: Runtime metadata HTTP response body.

Schema files that are not entry points are referenced by one or more of these entry points.

## 23. Current Event Names

The v1 event surface is:

- `endpoint.policy`
- `pairing.created`
- `pairing.connected`
- `conversation.create`
- `message.create`
- `message.delta`
- `message.block`
- `message.completed`
- `conversation.list`
- `conversation.created`
- `conversation.listed`
- `conversation.sync`
- `conversation.synced`
- `conversation.title.generate`
- `conversation.title.generated`
- `conversation.delete`
- `conversation.deleted`
- `conversation.delete_blocked`
- `message.cancel`
- `error`
- `ping`
- `pong`
- `transfer.request`
- `transfer.ready`
- `transfer.chunk.ack`
- `transfer.complete`
- `transfer.completed`
- `transfer.failed`
- `app.identity`
- `app.capabilities`
- `runtime.identity`
- `runtime.status`
- `runtime.capabilities`
- `runtime.agents`
- `runtime.slash_commands`
- `runtime.settings`
- `runtime.settings.update`
- `agent.settings.update`
- `runtime.artifact.created`
- `runtime.transfer.request`
- `runtime.transfer.completed`
- `runtime.transfer.failed`
- `session.resume`
- `session.resumed`
- `session.expired`
- `session.disconnected`

Runtime activity progress is represented by `message.block` events with `activity.*` block kinds. V1 does not define standalone `activity.*` event types.
