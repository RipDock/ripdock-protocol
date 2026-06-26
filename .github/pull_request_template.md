## Summary

Describe the protocol, schema, documentation, or fixture change.

## Change Type

- [ ] Documentation clarification only
- [ ] Non-breaking schema/spec change
- [ ] Breaking protocol change proposal
- [ ] Fixture or validation tooling change
- [ ] Non-normative example change

## Protocol Impact

Explain affected routes, events, fields, schemas, security behavior, or fixtures.
If there is no protocol impact, state that explicitly.

## Validation

- [ ] `make test`

## Checklist

- [ ] `SPEC.md` and schemas agree
- [ ] Valid and invalid fixtures cover changed behavior
- [ ] Public examples do not expose admin or development routes
- [ ] `THREAT_MODEL.md` is updated for security-sensitive changes
- [ ] `VERSIONING.md` rules were considered for compatibility impact
