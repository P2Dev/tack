# Public project site — 2026-10-08

The README now gives a four-command Docker start, a short product summary, and
task-oriented guide links. Setup generates private random secrets and preserves
existing configuration. Docker defaults to loopback access; the operations
guide covers intentional HTTPS/LAN deployment.

Maintained guides cover setup, daily use, boards, configuration, operations,
identity providers, agents/API/MCP, troubleshooting, development, contributions,
security, and project-site maintenance. Historical evidence remains separately
available. The static project overview and 15 guide pages use the same Markdown
sources, with navigation, contents links, search, metadata, sitemap, and 404 handling.

CI, GitHub Pages publishing, issue/PR templates, contribution guidance, editor
conventions, and private vulnerability reporting support public maintenance.
Generated site output and Next.js environment types are excluded from Git.

## Verification

- Typecheck/lint passed; all 38 unit/integration tests passed with the documented environment-loading commands.
- A clean temporary installation verified the Docker production build, healthy services, empty initial board, generated administrator sign-in, and five sample cards with zero page errors.
- Setup preserved existing configuration and created its environment file with private permissions.
- The smoke test used its own ports, Compose project, and database volume; those containers and volume were removed afterward. Existing Tack data was not used for acceptance writes or screenshots.
- Site build and README/source-reference checks passed: 17 static pages, 494 generated local links/assets/anchors, zero broken references.
- Rendered review and 12 axe route/width checks at 1440, 900, 390, and 320 pixels passed. Search, keyboard installation, mobile guide disclosure, enlarged-text reflow, reduced motion, forced colors, and page-error checks passed.
- Public screenshots use clean sample data; transient site screenshots stay in ignored build output.
- Initial GitHub application CI passed typecheck, lint, 38 integration tests, and production build. Its full browser run passed 74 checks, skipped six intentional duplicates, and exposed two failures. The status selector now stays disabled until React attaches its handler, preventing an early selection from being replayed with the old value. Archive restoration assertions now identify the created card rather than a title shared across runs. Repeated archive/queued-move checks passed six checks with two intentional skips; deliberately delayed-script hydration checks passed on both desktop and mobile.
- The [application CI workflow](https://github.com/P2Dev/tack/actions/workflows/ci.yml) runs the complete application and project-site checks for the published sources; use its commit-specific run for current results.

## UI audit outcomes

| Finding | Evidence and cause | Resolution |
| --- | --- | --- |
| High: command blocks could not be scrolled by keyboard | At narrow widths, long commands overflowed without a focusable region | Focusable code blocks and visible focus; axe and keyboard checks passed |
| Medium: homepage overflow at 320 pixels | The display heading forced a grid minimum wider than the content area | Intrinsic tracks and bounded narrow heading size; no page overflow at checked widths |
| Low: joined words in the narrow heading | Hiding a line break removed the only word separation | Explicit whitespace and rendered mobile verification |

This evidence covers Chromium and expert/browser review. It does not claim full
WCAG conformance, screen-reader acceptance, or representative-user validation.
The site documents the app; LAN/provider/agent-client deployment remains
installation-specific.

## Publication

The project site is published at [p2dev.github.io/tack](https://p2dev.github.io/tack/).
The [Pages deployment](https://github.com/P2Dev/tack/actions/runs/37859735159)
completed successfully for implementation commit 1cf8fc2. HTTPS checks passed
for all 21 published guide and asset URLs. A live browser check passed install
navigation, full-text search, axe, and page-error checks with zero violations or
page errors. GitHub Pages uses the Actions source and enforces HTTPS.

The repository homepage points to the site, and private vulnerability reporting
is enabled. The project-site delivery is complete; the application CI workflow
retains the full verification history for each source commit.
