const navigation = document.querySelector(".doc-navigation");
if (navigation) {
  const narrow = matchMedia("(max-width: 900px)");
  const update = () => {
    navigation.open = !narrow.matches;
  };
  update();
  narrow.addEventListener("change", update);
}
const search = document.querySelector("#guide-search");
if (search) {
  let indexPromise;
  let sequence = 0;
  search.addEventListener("input", async () => {
    const request = ++sequence;
    const status = document.querySelector("[data-search-status]");
    const list = document.querySelector("[data-search-results]");
    const query = search.value.toLowerCase().trim();
    list.replaceChildren();
    if (query.length < 2) {
      status.textContent = "Enter at least two characters.";
      return;
    }
    status.textContent = "Searching…";
    try {
      indexPromise ??= fetch(document.body.dataset.searchIndex)
        .then((response) => {
          if (!response.ok) throw new Error("Search unavailable");
          return response.json();
        })
        .catch((error) => {
          indexPromise = undefined;
          throw error;
        });
      const pages = await indexPromise;
      if (request !== sequence) return;
      const terms = query.split(/\s+/);
      const matches = pages
        .filter((page) =>
          terms.every((term) =>
            `${page.title} ${page.description} ${page.text}`
              .toLowerCase()
              .includes(term),
          ),
        )
        .sort(
          (a, b) =>
            Number(b.title.toLowerCase().includes(query)) -
            Number(a.title.toLowerCase().includes(query)),
        )
        .slice(0, 8);
      status.textContent = matches.length
        ? `${matches.length} matching guide${matches.length === 1 ? "" : "s"}.`
        : "No matching guide. Try a broader term.";
      const root = new URL(document.body.dataset.root, location.href);
      for (const page of matches) {
        const item = document.createElement("li");
        const link = document.createElement("a");
        const description = document.createElement("span");
        link.href = new URL(page.url, root).href;
        link.textContent = page.title;
        description.textContent = page.description;
        item.append(link, description);
        list.append(item);
      }
    } catch {
      if (request === sequence)
        status.textContent =
          "Search is unavailable. Use Browse documentation above.";
    }
  });
}
