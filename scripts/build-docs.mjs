import { readFile, mkdir, writeFile, copyFile, rm } from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { pages, repository, siteUrl } from "../site/pages.mjs";

const root = process.cwd();
const output = path.join(root, ".site");
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
  );
const hrefFrom = (file, target) =>
  path.posix.relative(path.posix.dirname(file), target) || "./";
const textOf = (value) =>
  Array.isArray(value)
    ? value.map(textOf).join("")
    : typeof value === "object" && value
      ? textOf(value.props?.children)
      : String(value ?? "");
const slugOf = (value) =>
  textOf(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-");
const pageBySource = new Map(pages.map((page) => [page.source, page]));
const targetOf = (page) => `${page.slug}/index.html`;
const localAssets = new Set();

function reference(value, source, outputFile, image = false) {
  if (!value || /^(?:[a-z][a-z0-9+.-]*:|#|\/\/)/i.test(value)) return value;
  const [file, fragment] = value.split("#");
  const [pathname, query] = file.split("?");
  const resolved = path.posix.normalize(
    path.posix.join(path.posix.dirname(source), decodeURIComponent(pathname)),
  );
  if (resolved.startsWith("../") || path.isAbsolute(resolved))
    throw new Error(`Reference outside repository: ${source}`);
  if (!existsSync(path.join(root, resolved)))
    throw new Error(`Missing source reference ${value} in ${source}`);
  const suffix = (query ? `?${query}` : "") + (fragment ? `#${fragment}` : "");
  const page = pageBySource.get(resolved);
  if (page) return hrefFrom(outputFile, targetOf(page)) + suffix;
  if (image) {
    localAssets.add(resolved);
    return hrefFrom(outputFile, `assets/${resolved}`) + suffix;
  }
  return `${repository}/blob/main/${resolved.split("/").map(encodeURIComponent).join("/")}${suffix}`;
}
function chrome(file, title, description, content) {
  const relative = (target) => hrefFrom(file, target);
  const header = `<a class="skip-link" href="#content">Skip to content</a><header class="site-header"><a class="wordmark" href="${relative("index.html")}" aria-label="Tack home"><span class="mark" aria-hidden="true">T</span>Tack</a><nav aria-label="Main"><a href="${relative("setup/index.html")}">Get started</a><a href="${relative("docs/index.html")}">Documentation</a><a href="${repository}">GitHub ↗</a></nav></header>`;
  const footer = `<footer class="site-footer"><p><strong>Tack</strong> · A small board for shared work.</p><p><a href="${relative("security/index.html")}">Security</a> · <a href="${repository}/blob/main/LICENSE">MIT license</a> · <a href="${repository}/issues">Issues</a></p></footer>`;
  const canonical = new URL(
    file === "index.html" ? "" : file.replace(/index\.html$/, ""),
    siteUrl,
  ).href;
  return `<!doctype html><html lang="en"><head>${file === "404.html" ? `<base href="${escape(siteUrl)}">` : ""}<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} · Tack</title><meta name="description" content="${escape(description)}"><meta name="theme-color" content="#f3efe5"><meta property="og:title" content="${escape(title)} · Tack"><meta property="og:description" content="${escape(description)}"><meta property="og:type" content="website"><meta property="og:url" content="${escape(canonical)}"><link rel="canonical" href="${escape(canonical)}"><link rel="icon" href="${relative("assets/favicon.svg")}" type="image/svg+xml"><link rel="stylesheet" href="${relative("assets/site.css")}"><script defer src="${relative("assets/site.js")}"></script></head><body data-search-index="${relative("search-index.json")}" data-root="${relative("index.html")}">${header}${content}${footer}</body></html>`;
}
function navigation(file, current) {
  let previousGroup = "";
  const items = pages
    .map((page) => {
      const group =
        page.group !== previousGroup
          ? `<p class="nav-group">${escape(page.group)}</p>`
          : "";
      previousGroup = page.group;
      return `${group}<a href="${hrefFrom(file, targetOf(page))}"${page.source === current ? ' aria-current="page"' : ""}>${escape(page.title)}</a>`;
    })
    .join("");
  return `<aside class="sidebar"><details class="doc-navigation" open><summary>Browse documentation</summary><nav aria-label="Documentation">${items}</nav></details><details class="search"><summary>Find a guide</summary><label for="guide-search">Search documentation</label><input id="guide-search" type="search" placeholder="Try API keys or backup" autocomplete="off"><p role="status" data-search-status>Search titles and guide contents.</p><ul data-search-results></ul></details></aside>`;
}

await rm(output, { recursive: true, force: true });
await mkdir(path.join(output, "assets"), { recursive: true });
for (const name of ["site.css", "site.js", "favicon.svg"])
  await copyFile(
    path.join(root, "site", name),
    path.join(output, "assets", name),
  );
const search = [];
for (const page of pages) {
  const markdown = await readFile(path.join(root, page.source), "utf8");
  const file = targetOf(page);
  const headings = [];
  const used = new Map();
  const heading =
    (tag) =>
    ({ children }) => {
      let id = slugOf(children);
      const duplicate = used.get(id) || 0;
      used.set(id, duplicate + 1);
      if (duplicate) id += `-${duplicate}`;
      if (tag === "h2") headings.push({ id, text: textOf(children) });
      return h(tag, { id }, children);
    };
  const html = renderToStaticMarkup(
    h(ReactMarkdown, {
      remarkPlugins: [remarkGfm],
      components: {
        h1: heading("h1"),
        h2: heading("h2"),
        h3: heading("h3"),
        h4: heading("h4"),
        a: ({ href, children }) =>
          h("a", { href: reference(href, page.source, file) }, children),
        img: ({ src, alt }) =>
          h("img", {
            src: reference(src, page.source, file, true),
            alt: alt || "",
            loading: "lazy",
            decoding: "async",
          }),
        pre: ({ children }) => h("pre", { tabIndex: 0 }, children),
        table: ({ children }) =>
          h(
            "div",
            {
              className: "table-scroll",
              tabIndex: 0,
              "aria-label": "Scrollable reference table",
            },
            h("table", null, children),
          ),
      },
      children: markdown,
    }),
  );
  const toc = headings.length
    ? `<nav class="toc" aria-label="On this page"><p>On this page</p>${headings.map(({ id, text }) => `<a href="#${id}">${escape(text)}</a>`).join("")}</nav>`
    : "";
  const content = `<div class="docs-layout">${navigation(file, page.source)}<main id="content" class="doc-content" tabindex="-1"><p class="eyebrow">${escape(page.group)}</p><article class="prose">${html}</article><div class="doc-end"><a href="${repository}/edit/main/${page.source}">Improve this page ↗</a><a href="${repository}/blob/main/${page.source}">Read Markdown source ↗</a></div></main>${toc}</div>`;
  await mkdir(path.dirname(path.join(output, file)), { recursive: true });
  await writeFile(
    path.join(output, file),
    chrome(file, page.title, page.description, content, page.source),
  );
  search.push({
    title: page.title,
    description: page.description,
    url: file,
    text: markdown,
  });
}
const readme = await readFile(path.join(root,"README.md"),"utf8");
renderToStaticMarkup(h(ReactMarkdown,{remarkPlugins:[remarkGfm],components:{
  a:({href,children})=>h("a",{href:reference(href,"README.md","index.html")},children),
  img:({src,alt})=>h("img",{src:reference(src,"README.md","index.html",true),alt:alt||""}),
},children:readme}));
const screenshot =
  "docs/images/board-desktop.png";
localAssets.add(screenshot);
const home = `<main id="content" class="home" tabindex="-1"><section class="hero"><div class="hero-copy"><p class="eyebrow">Self-hosted · Open source · MIT</p><h1>Keep work<br>moving.</h1><p class="hero-lead">A shared issue board that starts with a title. Add context as you go, and let your team and local agents work from the same place.</p><div class="actions"><a class="button primary" href="setup/index.html">Install Tack <span aria-hidden="true">↗</span></a><a class="button secondary" href="docs/index.html">Read the guides</a></div><p class="hero-note">Docker + PostgreSQL. Your infrastructure, your data.</p></div><div class="hero-install"><p class="eyebrow">From clone to first card</p><pre tabindex="0" aria-label="Setup commands"><code>git clone https://github.com/P2Dev/tack.git
cd tack
./scripts/setup.sh
docker compose up -d --build --wait</code></pre><p>Open <code>localhost:3000</code> and sign in with the generated credentials in <code>.env</code>.</p><a href="setup/index.html">Walk through setup →</a></div></section><figure class="board-preview"><div class="preview-caption"><span>The board, at a glance</span><span>Backlog → Ready → In progress → Done</span></div><img src="assets/${screenshot}" width="1440" height="1000" alt="Tack board showing cards organized into four status columns, with board navigation on the left"><figcaption>One shared view of what’s waiting, what’s moving, and what’s done.</figcaption></figure><section class="capabilities" aria-labelledby="capabilities"><div class="section-intro"><p class="eyebrow">Enough structure to stay aligned</p><h2 id="capabilities">Small cards.<br> Shared context.</h2></div><div class="feature-list"><article><span class="feature-number">01</span><div><h3>Start with a title</h3><p>Capture quickly. Add autosaved notes, labels, and an assignee when they help.</p></div></article><article><span class="feature-number">02</span><div><h3>Give each board its own space</h3><p>Switch seamlessly, use readable keys such as ENG-42, and move cards without losing old links.</p></div></article><article><span class="feature-number">03</span><div><h3>Bring your agents</h3><p>User-owned keys, scoped HTTP access, and a local MCP adapter with retry and conflict handling.</p></div></article><article><span class="feature-number">04</span><div><h3>Run it your way</h3><p>Docker and PostgreSQL, local or configured organization sign-in, and documented backups.</p></div></article></div></section><section class="guide-section" aria-labelledby="guides"><p class="eyebrow">Choose your next step</p><h2 id="guides">A guide for the job.</h2><div class="guide-links"><a href="user-guide/index.html"><span>For the team</span><strong>Learn the daily workflow →</strong></a><a href="deployment/index.html"><span>For the operator</span><strong>Deploy and maintain Tack →</strong></a><a href="agents/index.html"><span>For local agents</span><strong>Connect API keys and MCP →</strong></a><a href="development/index.html"><span>For contributors</span><strong>Run and test the code →</strong></a></div><p class="scope-note">Tack is a shared workspace with four fixed statuses. All human members share all boards; API keys can narrow their access. <a href="user-guide/index.html#scope-and-limits">Read the product scope.</a></p></section></main>`;
await writeFile(
  path.join(output, "index.html"),
  chrome(
    "index.html",
    "Keep work moving",
    "A self-hosted issue board for small teams and local agents. Install Tack and explore the complete guides.",
    home,
  ),
);
await writeFile(
  path.join(output, "404.html"),
  chrome(
    "404.html",
    "Page not found",
    "Find the right Tack guide.",
    `<main id="content" class="not-found"><p class="eyebrow">404</p><h1>This page moved.</h1><p>Use the documentation index to find the current guide.</p><a class="button primary" href="${new URL("docs/", siteUrl).href}">Open documentation</a></main>`,
  ),
);
for (const source of localAssets) {
  const destination = path.join(output, "assets", source);
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(path.join(root, source), destination);
}
await writeFile(path.join(output, "search-index.json"), JSON.stringify(search));
await writeFile(path.join(output, ".nojekyll"), "");
await writeFile(
  path.join(output, "robots.txt"),
  `User-agent: *\nAllow: /\nSitemap: ${new URL("sitemap.xml", siteUrl).href}\n`,
);
await writeFile(
  path.join(output, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${["", ...pages.map((page) => `${page.slug}/`)].map((slug) => `<url><loc>${escape(new URL(slug, siteUrl).href)}</loc></url>`).join("")}</urlset>`,
);
console.log(`Built ${pages.length + 2} static pages from Markdown into .site/`);
