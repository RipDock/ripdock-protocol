# RipDock Cloudflare Deployment Examples

These examples are non-normative deployment guidance for exposing a Runtime
through Cloudflare Tunnel and Cloudflare WAF rules.

The protocol security endpoints remain the App and Runtime. Cloudflare may
route, throttle, block, challenge, or disconnect traffic, but it is not trusted
for Runtime identity, Device identity, Session resume authorization, replay
protection, or message integrity.

Operators are responsible for securing any Runtime they expose directly or
through a tunnel. Use these files as a starting point, then tune them for the
Cloudflare plan, hostname, Runtime routes, and operational risk of the
deployment.

File:

- `cloudflare-rules.md`: example Cloudflare managed rules, WAF custom rule,
  rate limiting rule, and custom JSON block responses for a Runtime tunnel
  hostname.

Public Runtime routes expected by these examples:

- `GET /.well-known/ripdock/runtime-identity`
- `GET /.well-known/ripdock/runtime-metadata`
- `GET /ripdock/app`
- `GET /ripdock/app/pair/:pairingCode`
- `GET /ripdock/transfer/:transferId/:role`
- `GET /ripdock/transfer/:transferId/artifact`
- `POST /ripdock/pairing/request`
- `POST /ripdock/pairing/status`

Do not put `session_id`, Pairing tokens, Device private keys, resume signatures,
nonces, authorization material, or transfer credentials in URLs, Cloudflare rule
names, Cloudflare logs, tunnel names, hostnames, or example values.
