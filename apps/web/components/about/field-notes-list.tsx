import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { ArrowRight } from "lucide-react";
import type { PostMeta, PostStatus } from "@/lib/content/posts";

/**
 * About's journal treatment — a wide editorial list, deliberately not the
 * homepage's card carousel and not Monitoring's card grid. Rhythm comes from
 * type scale, a hairline rule per row, and generous row height rather than
 * card backgrounds.
 */

const STATUS_LABEL: Record<PostStatus, string | null> = {
  draft: "draft",
  demo: "demo",
  placeholder: "placeholder",
  verified: null,
};

function formatDate(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

export async function FieldNotesList({ posts }: { posts: PostMeta[] }) {
  const { dict } = await getI18n();
  if (posts.length === 0) {
    return <p className="text-sm leading-relaxed text-muted">{dict.notes.empty}</p>;
  }

  return (
    <div className="divide-y divide-border/60 border-y border-border/60">
      {posts.map((post) => {
        const status = STATUS_LABEL[post.status];
        return (
          <Link
            key={post.slug}
            href={`/posts/${post.slug}`}
            className="group flex flex-col gap-4 py-7 transition-colors duration-[var(--motion-base)] hover:bg-muted/20 md:flex-row md:items-baseline md:gap-10 md:py-9"
          >
            <div className="flex shrink-0 items-center gap-3 md:w-52 md:flex-col md:items-start md:gap-2">
              <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-accent">{post.category}</span>
              <span className="text-xs text-muted">
                {formatDate(post.date)}
                {post.readingTime ? ` · ${post.readingTime}` : null}
              </span>
            </div>

            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-baseline gap-3">
                <h3 className="text-xl font-semibold leading-snug tracking-tight md:text-2xl">{post.title}</h3>
                {status ? (
                  <span className="rounded-sm bg-muted/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                    {status}
                  </span>
                ) : null}
              </div>
              <p className="max-w-2xl text-sm leading-relaxed text-muted">{post.excerpt}</p>
            </div>

            <ArrowRight
              className="hidden h-5 w-5 shrink-0 text-muted transition-transform duration-[var(--motion-base)] group-hover:translate-x-1 group-hover:text-accent md:block"
              aria-hidden
            />
          </Link>
        );
      })}
    </div>
  );
}
