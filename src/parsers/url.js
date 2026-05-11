import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

export async function parseUrl(url) {
  const response = await fetch(url);
  const html = await response.text();
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  if (!article) throw new Error(`Could not extract content from ${url}`);

  return `${article.title}\n\n${article.textContent}`.trim();
}
