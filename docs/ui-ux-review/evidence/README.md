# Review evidence

Captured 2026-09-20 from current workspace source. Read [the plan](../PLAN.md)
for scope, findings, and evidence limits. Screenshots are original current-state
renders, not proposed designs. Archived/failure captures use intercepted API
responses. The Next.js development indicator is not product UI.

The accompanying scripts are audit reproductions, not passing regression tests.
They record current defects. They assume the reviewed six-card fixture, including
TCK-1 in Backlog, another visible card, and a local administrator. Adapt the fixture
if the board changes; do not overwrite application data to recreate these inputs.

With current source running at `http://localhost:3105`, the existing PostgreSQL
database available, and `.env` containing the local admin credentials, run from
the workspace root:

```sh
node --env-file=.env docs/ui-ux-review/evidence/capture-baseline.mjs
node --env-file=.env docs/ui-ux-review/evidence/probe-interactions.mjs
```

Set the development server's auth origin/trusted origin to that same local URL
and its database connection to the documented local PostgreSQL instance. Keep
secrets out of command output. Scripts read credentials from the process
environment and do not write credentials or browser storage state to artifacts.
They create real authentication sessions. Issue writes are intercepted in the
probe script; it neither changes account access nor persists issue changes.

`baseline.json` contains viewport measurements and sign-in redirect behavior.
`interaction-probes.json` contains observed state transitions and axe results.
The two recorded HTTP 500 console errors are intentional simulated save failures.
Screenshots and JSON are replaced when rerun. Browser measurements do not prove
real-user comprehension, server persistence under faults, or accessibility
conformance.

## U2 implementation evidence

The `u2/` directory contains final production captures of the same original six
cards, their measurements in `comparison.json`, and `fixture-*` captures from the
passing U2 browser tests. The fixture captures include seven widths, editor order,
and 200% text. These are implemented renders, not mockups.

With the final production build served locally at the same origin and the normal
local database available, the comparison can be reproduced read-only with:

```sh
node --env-file=.env docs/ui-ux-review/evidence/u2/capture-after.mjs
```

The `capture-after.mjs` script signs in and reads data; it never creates, edits,
archives, or deletes cards. Do not rerun the old baseline scripts over the
preserved before images. See [U2 delivery](../U2-DELIVERY.md).

## U3 implementation evidence

The `u3/` directory contains desktop/mobile recovery and administration captures
from the isolated browser suite, plus production captures of the original local
board and the 320 px Team page. `production-check.json` records overflow/page
exceptions and the comparison with the original six-card titles/statuses.

The production script signs in and reads only; it does not change cards or
account access. With the app served locally at `http://localhost:3105`:

```sh
node --env-file=.env docs/ui-ux-review/evidence/u3/capture-production.mjs
```

Test screenshots contain synthetic accounts and injected error responses.
The development indicator is not product UI. See [U3 delivery](../U3-DELIVERY.md)
for exact verification counts and limitations.
