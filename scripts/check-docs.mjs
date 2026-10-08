import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
const root = path.resolve(".site");
async function filesIn(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await filesIn(file)));
    else files.push(file);
  }
  return files;
}
const files = await filesIn(root);
const html = new Map();
const failures = [];
let checked = 0;
for (const file of files.filter((file) => file.endsWith(".html")))
  html.set(file, await readFile(file, "utf8"));
for (const [file, content] of html) {
  const ids = new Set(
    [...content.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]),
  );
  if ([...content.matchAll(/\bid="([^"]+)"/g)].length !== ids.size)
    failures.push(`${path.relative(root, file)} has duplicate element IDs`);
  for (const match of content.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    const value = match[1].replaceAll("&amp;", "&");
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value)) continue;
    const [pathname, fragment] = value.split("#");
    let target = pathname
      ? path.resolve(
          path.dirname(file),
          decodeURIComponent(pathname.split("?")[0]),
        )
      : file;
    if (!target.startsWith(root + path.sep) && target !== root) {
      failures.push(`${value} escapes the output`);
      continue;
    }
    try {
      if ((await stat(target)).isDirectory())
        target = path.join(target, "index.html");
      await stat(target);
      checked++;
      if (fragment && target.endsWith(".html")) {
        const targetHtml = html.get(target) ?? (await readFile(target, "utf8"));
        if (!targetHtml.includes(`id="${decodeURIComponent(fragment)}"`))
          failures.push(
            `${path.relative(root, file)} has missing anchor ${value}`,
          );
      }
    } catch {
      failures.push(
        `${path.relative(root, file)} has missing reference ${value}`,
      );
    }
  }
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else
  console.log(
    `Checked ${html.size} pages and ${checked} local links/assets: no broken references.`,
  );
