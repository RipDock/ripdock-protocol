# Cloudflare Tunnel Security Example

This is an example Cloudflare setup for a Runtime exposed through a dedicated
Cloudflare Tunnel hostname:

```text
runtime.example.com
```

Replace that hostname with the actual Runtime hostname. This is deployment
guidance, not part of the RipDock Protocol contract. The person operating the
tunnel is responsible for securing that tunnel.

Cloudflare WAF custom rules and rate limiting rules apply to normal HTTP
requests and to the initial HTTP WebSocket upgrade request. After a WebSocket is
established, Cloudflare WAF does not inspect individual WebSocket messages. The
Runtime still performs protocol security checks such as signed Session resume,
Device trust, nonce replay prevention, timestamp freshness, authorization, and
message-size validation.

## Managed Rules

Enable these managed rules for all incoming requests:

- Cloudflare Managed Ruleset: `Execute`
- Cloudflare OWASP Core Ruleset: `Execute`

Do not add Managed Rule Exceptions unless Cloudflare Security Events show a
false positive for valid Runtime traffic. Scope any exception to the specific
hostname, path, and managed rule.

## Custom Rules

Create one Custom Rule:

```text
RipDock Tunnel Security
```

Action: `Block`

Custom response:

- Status code: `403`
- Content-Type: `application/json`
- Body:

```json
{
  "type": "error",
  "protocol_version": "1",
  "code": "runtime.unavailable",
  "message": "Request blocked."
}
```

Expression:

```text
(http.host eq "runtime.example.com" and (
  lower(http.request.uri.query) contains "session_id=" or
  lower(http.request.uri.query) contains "sessionid=" or
  lower(http.request.uri.query) contains "token=" or
  lower(http.request.uri.query) contains "signature=" or
  lower(http.request.uri.query) contains "nonce=" or
  lower(http.request.uri.query) contains "pairingtoken=" or
  lower(http.request.uri.query) contains "transfer_token=" or

  not (
    http.request.uri.path eq "/.well-known/ripdock/runtime-identity" or
    http.request.uri.path eq "/.well-known/ripdock/runtime-metadata" or
    http.request.uri.path eq "/ripdock/pairing/request" or
    http.request.uri.path eq "/ripdock/pairing/status" or
    http.request.uri.path eq "/ripdock/app" or
    starts_with(http.request.uri.path, "/ripdock/app/pair/") or
    starts_with(http.request.uri.path, "/ripdock/transfer/")
  ) or

  (http.request.uri.path eq "/.well-known/ripdock/runtime-identity" and http.request.method ne "GET") or
  (http.request.uri.path eq "/.well-known/ripdock/runtime-metadata" and http.request.method ne "GET") or
  (http.request.uri.path eq "/ripdock/app" and http.request.method ne "GET") or
  (starts_with(http.request.uri.path, "/ripdock/app/pair/") and http.request.method ne "GET") or
  (starts_with(http.request.uri.path, "/ripdock/transfer/") and http.request.method ne "GET") or
  (http.request.uri.path eq "/ripdock/pairing/request" and http.request.method ne "POST") or
  (http.request.uri.path eq "/ripdock/pairing/status" and http.request.method ne "POST")
))
```

This rule blocks credential-like query parameters, blocks unknown public paths,
and blocks HTTP methods that are not expected for known Runtime routes.

The custom response body intentionally uses the same error shape as Runtime
errors so Apps can show a short user-facing message when they choose to parse
non-2xx HTTP response bodies. This response is Cloudflare deployment behavior,
not a Protocol requirement.

## Rate Limiting Rules

Create one Rate Limiting Rule:

```text
RipDock Tunnel Rate Limiting
```

Expression:

```text
(http.host eq "runtime.example.com" and (
  http.request.uri.path eq "/.well-known/ripdock/runtime-identity" or
  http.request.uri.path eq "/.well-known/ripdock/runtime-metadata" or
  http.request.uri.path eq "/ripdock/pairing/request" or
  http.request.uri.path eq "/ripdock/pairing/status" or
  starts_with(http.request.uri.path, "/ripdock/app/pair/")
))
```

Settings:

- Characteristics: `IP`
- Threshold: `60 requests per 1 minute`
- Action: `Block`
- Mitigation duration: `1 minute`
- Order: `First`

Custom response:

- Status code: `429`
- Content-Type: `application/json`
- Body:

```json
{
  "type": "error",
  "protocol_version": "1",
  "code": "runtime.rate_limited",
  "message": "Too many requests. Try again soon."
}
```

This protects Pairing, identity, and metadata endpoints without applying an
aggressive HTTP request rate limit to the main Runtime WebSocket path.

Use the same generic rate-limit response for this single rule. Avoid separate
Pairing-specific responses unless the deployment later adds a separate
Pairing-only rate limit rule.

## Admin Surfaces

Keep Runtime admin, dashboard, development, and diagnostics routes off the
public Runtime hostname. Use a separate private hostname protected by
Cloudflare Access, or keep those routes bound to localhost/private networks.

## Verification Checklist

1. `https://runtime.example.com/.well-known/ripdock/runtime-identity` returns
   Runtime identity.
2. `https://runtime.example.com/.well-known/ripdock/runtime-metadata` returns
   Runtime metadata.
3. Unknown paths, such as `/wp-admin`, return a Cloudflare block.
4. Known paths with credential-like query parameters are blocked.
5. Unexpected methods on known paths are blocked.
6. Pairing request and approval work from the App.
7. `wss://runtime.example.com/ripdock/app` opens and chat works.
8. File transfer paths work when the Runtime and App use transfers.
9. Cloudflare Security Events show no blocks for valid App traffic.
