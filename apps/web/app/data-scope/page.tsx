import type { Metadata } from "next";
import { PublicShell } from "@/components/layout/public-shell";
import { ToolPageHeading } from "@/components/layout/tool-page-heading";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.dataScope.pageTitle };
}

/**
 * Full "scope and limits" notice plus how a figure is read.
 *
 * LEGAL REVIEW PENDING: the four notice paragraphs are the project's draft
 * wording. They must be reviewed before official release; this page does not
 * claim a legal status of its own.
 */
export default async function DataScopePage() {
  const { dict } = await getI18n();
  const s = dict.dataScope;
  const m = s.method;
  return (
    <PublicShell activePath="/data-scope">
      <ToolPageHeading title={s.pageTitle} description={s.pageEyebrow} className="h-text" />
      <article className="h-text space-y-10" id="pham-vi-du-lieu">
        <section aria-labelledby="scope-notice" className="space-y-4">
          <h2 id="scope-notice" className="text-lg font-semibold">
            {s.pageTitle}
          </h2>
          {[s.notice.p1, s.notice.p2, s.notice.p3, s.notice.p4].map((p) => (
            <p key={p} className="leading-relaxed text-foreground-muted">
              {p}
            </p>
          ))}
          {/* Visible marker so nobody mistakes the draft for approved text. */}
          <p
            className="border-l-2 border-watch pl-3 text-xs text-foreground-subtle"
            data-legal-review="pending"
          >
            {s.legalPending}
          </p>
        </section>

        <section aria-labelledby="scope-method" className="space-y-4">
          <h2 id="scope-method" className="text-lg font-semibold">
            {m.title}
          </h2>
          <p className="text-foreground-muted">{m.intro}</p>
          <ul className="list-disc space-y-2 pl-5 text-foreground-muted">
            <li>{m.freshness}</li>
            <li>{m.quality}</li>
            <li>{m.threshold}</li>
            <li>{m.history}</li>
          </ul>
          <ul className="space-y-2 text-foreground-muted">
            <li>
              <strong>{m.green}</strong>
            </li>
            <li>
              <strong>{m.yellow}</strong>
            </li>
            <li>
              <strong>{m.red}</strong>
            </li>
            <li>
              <strong>{m.gray}</strong>
            </li>
          </ul>
        </section>
      </article>
    </PublicShell>
  );
}
