import "server-only";

/**
 * Shared `---` frontmatter reader for the local content system (posts,
 * gallery). Deliberately scoped: flat `key: value` scalars only — no
 * nesting, no lists, no multi-line values. That covers every field the
 * content schemas actually use and keeps the project's zero-new-dependency
 * discipline; swap in gray-matter here if richer frontmatter is ever needed
 * and nothing else has to change.
 */

export interface ParsedFrontmatter {
  data: Record<string, string>;
  body: string;
}

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * Splits the frontmatter block from the body. Values containing `:` (URLs,
 * sentences) survive — only the first colon separates key from value.
 */
export function parseFrontmatter(raw: string): ParsedFrontmatter {
  const normalized = raw.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) {
    return { data: {}, body: normalized };
  }

  const end = normalized.indexOf("\n---", 4);
  if (end === -1) {
    return { data: {}, body: normalized };
  }

  const block = normalized.slice(4, end);
  const body = normalized.slice(end + 4).replace(/^\n/, "");
  const data: Record<string, string> = {};

  for (const line of block.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const colon = trimmed.indexOf(":");
    if (colon === -1) continue;
    const key = trimmed.slice(0, colon).trim();
    const value = stripQuotes(trimmed.slice(colon + 1));
    if (key) data[key] = value;
  }

  return { data, body };
}
