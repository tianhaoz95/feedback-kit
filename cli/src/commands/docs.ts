import { getDocTopic, listDocTopics } from "../docs.js";

export async function printDocs(topic: string | undefined): Promise<void> {
  if (!topic) {
    console.log("Available topics (run `feedbackkit docs <topic>` for one):\n");
    for (const { slug, title, summary } of listDocTopics()) {
      console.log(`  ${slug.padEnd(10)} ${title} — ${summary}`);
    }
    return;
  }

  const doc = getDocTopic(topic);
  if (!doc) {
    const available = listDocTopics().map((t) => t.slug).join(", ");
    throw new Error(`Unknown doc topic "${topic}". Available: ${available}`);
  }
  console.log(doc.content);
}
