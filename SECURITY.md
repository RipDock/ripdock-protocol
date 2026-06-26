# Security Policy

## Reporting A Vulnerability

Please report suspected security vulnerabilities privately by emailing:

security@ripdock.com

Do not open a public GitHub issue for vulnerabilities that could expose users,
implementations, credentials, private keys, Session IDs, Pairing material, or
deployment details.

## Scope

Security reports for RipDock Protocol should focus on:

- protocol authentication or trust-boundary flaws
- Pairing, Session, resume, replay, or revocation issues
- schema or specification ambiguity with security impact
- guidance that could cause unsafe implementations

Implementation-specific vulnerabilities should be reported to the relevant
implementation repository unless the issue is caused by the protocol contract.

## Response

We aim to acknowledge receipt within 3 business days.

After acknowledgment, we will:

1. investigate the report
2. confirm whether the issue is protocol-level or implementation-specific
3. coordinate a fix, clarification, or mitigation when needed
4. coordinate disclosure timing with the reporter when disclosure is appropriate

Response times may vary with severity, complexity, and maintainer availability,
but reports involving active exploitation or credential exposure are prioritized.
