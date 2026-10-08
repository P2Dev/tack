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

GitHub Pages is configured to use Actions at https://p2dev.github.io/tack/.
The verified sources and CI/Pages workflows are prepared for the main branch.
Successful workflow runs and live-site acceptance complete publication.
