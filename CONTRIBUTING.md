# Contribute to Tack

Start with the [development guide](docs/DEVELOPMENT.md) and
[architecture](ARCHITECTURE.md). Keep changes focused on a real user workflow or
observed defect; Tack deliberately has four statuses and a small shared-workspace model.

## Propose or implement a change

1. Search existing issues before opening a bug report or feature request.
2. Describe the problem, reproduction/use case, and expected outcome.
3. Fork the repository or create a feature branch.
4. Implement the change and update relevant guides/contracts.
5. Run typecheck, lint, relevant tests, and the production build. For documentation,
   also run `pnpm docs:build` and `pnpm docs:check`; render UI changes at narrow/wide widths.
6. Open a pull request describing the resulting behavior and actual verification.

Use meaningful behavioral tests for auth, data, and shared-state changes. Preserve
board-key aliases, transactional ordering, credential boundaries, and agent
revision/idempotency rules. Add a new ordered SQL migration rather than editing a
migration deployed to existing installations.

Never commit `.env`, credentials, live data, database dumps, dependencies, build
output, or test reports. Screenshot evidence should use sample/disposable data.
Security problems should follow [private reporting](SECURITY.md), not a public issue.

## Documentation

Current task-oriented guides live in `docs/`; [the index](docs/README.md) links
historical project records separately. The project site builds from those same
Markdown files. Add a maintained page to `site/pages.mjs`, then verify links and
navigation. See [project-site maintenance](docs/PROJECT_SITE.md).

Contributions are covered by the project’s [MIT license](LICENSE).
