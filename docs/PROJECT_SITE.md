# Maintain the project site

The public site at [p2dev.github.io/tack](https://p2dev.github.io/tack/) is a static
project overview and documentation site. The actual Tack app runs separately
with Next.js and PostgreSQL.

## Build and preview

```sh
pnpm install --frozen-lockfile
pnpm docs:build
pnpm docs:check
pnpm docs:preview
```

Open [127.0.0.1:4173](http://127.0.0.1:4173). Set `DOCS_PORT` to change the preview
port. The generator writes `.site/`, which is ignored by Git and Docker. It
renders Markdown using the existing React Markdown renderer plus GitHub-flavored
Markdown support, copies only referenced images, and generates search, sitemap,
metadata, and a 404 page. No app credentials or database connection are needed.

## Change content

Edit the current guide in `docs/` or its root source file. `site/pages.mjs` lists
the guides published on the site, their title/group, and output slug. Add a page
there when adding a maintained guide. Historical reports remain in the repository
and are linked as project records rather than copied wholesale to the website.

Internal links point to the published guide when available; other repository
references link to their Markdown/source on GitHub. The build rejects missing
local source references. `pnpm docs:check` checks all local generated links,
assets, and anchors. Use relative paths so project sites work below `/tack/`.

The homepage composition lives in `scripts/build-docs.mjs`. Shared presentation
and navigation/search behavior live in `site/site.css` and `site/site.js`.
The visual direction follows Tack: warm paper surfaces, serif headings, restrained
rust accents, real board screenshots, and task-first guide navigation. It avoids
a live-app imitation and a separate duplicated documentation content set.

## Verify in a browser

```sh
pnpm exec playwright install chromium
pnpm docs:verify
```

This starts its own loopback server, checks the home/setup/API pages at four
widths, runs axe, exercises search and keyboard/mobile navigation, checks enlarged
text, and captures ignored screenshots under `.site/verification/`.
Inspect those screenshots when changing layout. Automated accessibility checks do
not replace screen-reader or representative-user validation.

## GitHub Pages publishing

`.github/workflows/pages.yml` builds and checks the site for pull requests and
pushes to `main`. Pushes to `main` deploy the checked `.site` artifact using the
GitHub Pages environment; pull requests only build. The repository’s Pages source
must be **GitHub Actions**. Manual runs are also available in Actions.

The independent CI workflow verifies the application, database tests, browser
flows, and documentation build. Pages publishing does not expose a Tack database,
create app accounts, or configure your LAN instance.

For a fork, enable Pages with Actions, set `TACK_SITE_URL` in the workflow to your
public URL, and update repository metadata, source/edit links in `site/pages.mjs`,
and the project-site links in the README. Keep deployment permissions limited to
the deploy job. GitHub documents [custom Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
