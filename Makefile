.DEFAULT_GOAL := help
.PHONY: help db-push db-push-dry db-list db-test

DB_TARGETS := db-push db-push-dry db-list
DB_GOALS := $(filter $(DB_TARGETS),$(MAKECMDGOALS))
ifneq ($(strip $(DB_GOALS)),)
ifneq ($(words $(DB_GOALS)),1)
$(error Run only one database target at a time)
endif
DB_POSITIONAL := $(filter-out $(DB_TARGETS),$(MAKECMDGOALS))
ifneq ($(word 2,$(DB_POSITIONAL)),)
$(error Specify only one migration filename, version, or name)
endif
ifneq ($(strip $(DB_POSITIONAL)),)
ifneq ($(filter help db-test,$(DB_POSITIONAL)),)
$(error Run database targets separately from other targets)
endif
ifneq ($(strip $(MIGRATION)),)
$(error Use either a positional migration or MIGRATION=, not both)
endif
override MIGRATION := $(DB_POSITIONAL)
.PHONY: $(DB_POSITIONAL)
$(DB_POSITIONAL):
	@node -e ""
endif
endif

help: ## List available targets
	@node -e "const fs=require('fs');for(const l of fs.readFileSync('Makefile','utf8').split(/\r?\n/)){const m=/^([a-zA-Z0-9_-]+):.*?## (.*)$$/.exec(l);if(m)console.log('  '+m[1].padEnd(28)+m[2]);}"

# we harcoded supabase terminal commands because our network is ipV4 and supabase uses ipV6
db-list: ## Show applied/pending local migrations over HTTPS (read-only)
	@node scripts/db-push.mjs --list "$(MIGRATION)"

db-push-dry: ## Prepare pending migrations over HTTPS without applying them
	@node scripts/db-push.mjs --dry-run "$(MIGRATION)"

db-push: ## Apply pending migrations to production (append a filename or use MIGRATION=<version or name>)
	@node scripts/db-push.mjs "$(MIGRATION)"

db-test: ## Run offline database tests (tests/*.test.mjs)
	@node -e "const fs=require('fs'),cp=require('child_process');const files=(fs.existsSync('tests')?fs.readdirSync('tests'):[]).filter(n=>n.endsWith('.test.mjs')).map(n=>'tests/'+n);if(!files.length){console.log('No database tests yet. Add tests/<name>.test.mjs.');process.exit(0);}process.exit(cp.spawnSync(process.execPath,['--test',...files],{stdio:'inherit'}).status ?? 1);"
