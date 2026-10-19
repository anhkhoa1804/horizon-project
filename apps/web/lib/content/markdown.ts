import "server-only";

/**
 * Minimal Markdown → HTML renderer for the local Field Notes posts.
 *
 * Scope is intentionally narrow — headings, paragraphs, bold, italic, inline
 * code, links, unordered and ordered lists. That is exactly what the posts in
 * apps/web/content/posts/ use. It is not a general Markdown implementation
 * and should not be pointed at untrusted input: it renders only files
 * committed to this repository, which is why a full parser (and its
 * dependency weight) is not warranted here. Reach for `remark` if posts ever
 * need tables, footnotes, or embedded HTML.
 *
 * Everything is HTML-escaped before any inline formatting is applied, so a
 * `<` in prose stays literal text rather than becoming markup.
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Inline formatting, applied to already-escaped text. */
function inline(text: string): string {
  return (
    text
      // `code`
      .replace(/`([^`]+)`/g, '<code class="rounded-sm bg-muted/30 px-1.5 py-0.5 text-[0.9em]">$1</code>')
      // **bold**
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      // *italic*
      .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
      // [label](href) — only http(s) and root-relative targets are allowed
      // through; anything else (javascript:, data:) renders as plain text.
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label: string, href: string) => {
        const safe = /^(https?:\/\/|\/)/.test(href.trim());
        if (!safe) return match;
        const external = href.trim().startsWith("http");
        const rel = external ? ' target="_blank" rel="noreferrer"' : "";
        return `<a href="${href.trim()}" class="text-accent underline-offset-2 hover:underline"${rel}>${label}</a>`;
      })
  );
}

export function renderMarkdown(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];

  let paragraph: string[] = [];
  let listType: "ul" | "ol" | null = null;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    html.push(`<p>${inline(escapeHtml(paragraph.join(" ")))}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (!listType) return;
    html.push(`</${listType}>`);
    listType = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === "") {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flushParagraph();
      flushList();
      // The page owns the <h1> (the post title), so body headings start at
      // <h2>. Both `#` and `##` clamp to h2 because posts in this project
      // use `##` as their top body heading — mapping that to h3 skipped a
      // level and left the page's own "Ghi chép khác" <h2> appearing after
      // a deeper heading, which is the kind of out-of-order structure screen
      // readers surface as a broken outline.
      const level = Math.min(Math.max(heading[1].length, 2), 4);
      html.push(`<h${level}>${inline(escapeHtml(heading[2]))}</h${level}>`);
      continue;
    }

    const unordered = /^[-*]\s+(.*)$/.exec(trimmed);
    if (unordered) {
      flushParagraph();
      if (listType !== "ul") {
        flushList();
        html.push("<ul>");
        listType = "ul";
      }
      html.push(`<li>${inline(escapeHtml(unordered[1]))}</li>`);
      continue;
    }

    const ordered = /^\d+\.\s+(.*)$/.exec(trimmed);
    if (ordered) {
      flushParagraph();
      if (listType !== "ol") {
        flushList();
        html.push("<ol>");
        listType = "ol";
      }
      html.push(`<li>${inline(escapeHtml(ordered[1]))}</li>`);
      continue;
    }

    flushList();
    paragraph.push(trimmed);
  }

  flushParagraph();
  flushList();

  return html.join("\n");
}
