#!/usr/bin/env bash

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$PROJECT_ROOT/node"

printf '%s\n' "===== 1/4 LINT ====="
npm run lint

printf '%s\n' '' "===== 2/4 TESTS + COVERAGE ====="
npm test -- --coverage

printf '%s\n' '' "===== 3/4 DATABASE MIGRATIONS ====="
npm run migrate

printf '%s\n' '' "===== 4/4 SCHEMA VERIFICATION ====="
npm run verify-schema

printf '%s\n' '' "========================================"
printf '%s\n' "LOCAL VERIFICATION PASSED"
printf '%s\n' "========================================"
