SHELL := /bin/bash
.SHELLFLAGS := -eu -o pipefail -c

AJV := npx --yes ajv-cli@5.0.0

PROTOCOL_FILES := README.md SPEC.md AGENTS.md
SCHEMA_FILES := $(sort $(wildcard schemas/*.schema.json))
EVENT_SCHEMA_REFS := $(filter-out schemas/event.schema.json,$(SCHEMA_FILES))
VALID_EVENT_FIXTURES := $(sort $(wildcard tests/fixtures/events/valid/*.json))
INVALID_EVENT_FIXTURES := $(sort $(wildcard tests/fixtures/events/invalid/*.json))

.PHONY: help test validate json-validate schema-compile schema-fixture-check protocol-policy-check

help:
	@printf 'RipDock Protocol validation commands:\n'
	@printf '  make test               Run all protocol validation checks\n'
	@printf '  make validate           Alias for make test\n'
	@printf '  make json-validate      Parse all JSON Schema files\n'
	@printf '  make schema-compile     Compile schemas/*.schema.json with AJV draft 2020\n'
	@printf '  make schema-fixture-check Validate event schema fixtures with AJV\n'
	@printf '  make protocol-policy-check Validate protocol documentation policy\n'

test: json-validate schema-compile schema-fixture-check protocol-policy-check
	@printf 'PASS test\n'

validate: test

json-validate:
	@for f in $(SCHEMA_FILES); do \
		node -e "JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'))" "$$f" || { printf 'FAIL json-validate %s\n' "$$f"; exit 1; }; \
	done
	@printf 'PASS json-validate\n'

schema-compile:
	@for schema in $(SCHEMA_FILES); do \
		base="$$(basename "$$schema")"; \
		refs=(); \
		for r in $(SCHEMA_FILES); do \
			[ "$$(basename "$$r")" = "$$base" ] && continue; \
			refs+=( -r "$$r" ); \
		done; \
		$(AJV) compile --spec=draft2020 --strict=false -s "$$schema" "$${refs[@]}" >/dev/null || { printf 'FAIL schema-compile %s\n' "$$schema"; exit 1; }; \
		printf '%s compiled\n' "$$schema"; \
	done
	@printf 'PASS schema-compile\n'

schema-fixture-check:
	@node tests/validate-fixtures.mjs

protocol-policy-check:
	@node tests/policy-check.mjs
