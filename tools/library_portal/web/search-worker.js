"use strict";
let content = null;
let pending = null;
async function load(shards) {
  if (content) return content;
  if (!pending)
    pending = (async () => {
      const rows = new Map();
      for (let i = 0; i < shards.length; i++) {
        const response = await fetch(shards[i]);
        if (!response.ok)
          throw new Error("搜索索引读取失败：" + response.status);
        for (const row of await response.json()) rows.set(row.id, row.text);
        postMessage({ type: "progress", done: i + 1, total: shards.length });
      }
      content = rows;
      return rows;
    })().catch((error) => {
      pending = null;
      throw error;
    });
  return pending;
}
onmessage = async ({ data }) => {
  if (data.type !== "search") return;
  try {
    const terms = data.query
      .trim()
      .toLocaleLowerCase()
      .split(/\s+/u)
      .filter(Boolean);
    const rows =
      terms.length && data.scope !== "title"
        ? await load(data.shards)
        : new Map();
    const results = [];
    for (const doc of data.documents) {
      const title = doc.title.toLocaleLowerCase();
      const meta = [
        doc.title,
        doc.name,
        doc.path,
        doc.alias,
        ...doc.institutions,
        ...doc.topics,
      ]
        .join(" ")
        .toLocaleLowerCase();
      const original = rows.get(doc.id) || "";
      const body = original.toLocaleLowerCase();
      const haystack = data.scope === "title" ? title : meta + "\n" + body;
      if (!terms.every((term) => haystack.includes(term))) continue;
      const score = terms.reduce(
        (sum, term) =>
          sum + (title.includes(term) ? 100 : meta.includes(term) ? 30 : 1),
        0,
      );
      let snippet = "";
      if (terms.length) {
        const hits = terms
          .map((term) => body.indexOf(term))
          .filter((i) => i >= 0);
        if (hits.length) {
          const start = Math.max(0, Math.min(...hits) - 55);
          snippet =
            (start ? "…" : "") +
            original.slice(start, start + 230).replace(/\s+/g, " ") +
            (start + 230 < original.length ? "…" : "");
        }
      }
      results.push({ id: doc.id, score, snippet });
    }
    postMessage({ type: "results", request: data.request, results });
  } catch (error) {
    postMessage({
      type: "error",
      request: data.request,
      message: String(error.message || error),
    });
  }
};
