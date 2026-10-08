import { closeDatabase, getDatabase } from "../src/lib/database";
import { createIssueStore } from "../src/lib/issue-store";

const store = createIssueStore(getDatabase());

if ((await store.snapshot()).active.length > 0) {
  console.log("Seed skipped: the board already contains active issues.");
} else {
  const samples = [
    {
      title: "Make the first issue effortless to capture",
      description:
        "The title is enough. Everything else should be something we can add later.",
      status: "backlog" as const,
    },
    {
      title: "Decide where the pilot will live",
      description:
        "Choose the shared host only after the local workflow feels right.",
      status: "backlog" as const,
    },
    {
      title: "Keep the board readable at a glance",
      description:
        "Use short cards, quiet metadata, and clear column boundaries.",
      status: "ready" as const,
    },
    {
      title: "Build title-only quick add",
      description: "Typing a title and pressing Enter should create a card.",
      status: "in_progress" as const,
    },
    {
      title: "Agree on four plain-language states",
      description:
        "Backlog, Ready, In progress, and Done are enough for the pilot.",
      status: "done" as const,
    },
  ];

  for (const sample of samples) {
    const issue = await store.create({
      title: sample.title,
      status: sample.status,
    });
    await store.update(issue.id, { description: sample.description });
  }

  console.log(`Seeded ${samples.length} issues.`);
}

await closeDatabase();
