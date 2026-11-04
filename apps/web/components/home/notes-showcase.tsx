import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { PostMeta } from "@/lib/content/posts";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { formatPostDate } from "@/lib/content/postFormat";

/**
 * Home journal as a reading list: one row per note (date and category, title, one line of
 * excerpt, a small photograph), hairlines between rows, then a link to every note.
 */
export function NotesShowcase({ posts, dict, locale }: { posts: PostMeta[]; dict: Dictionary; locale: Locale }) {
  if (posts.length === 0) return <p className="text-sm leading-relaxed text-muted">{dict.notes.emptyLong}</p>;
  const shown = posts.slice(0, 5);
  return (
    <div>
      <ol className="notes-list">
        {shown.map((post) => (
          <li key={post.slug}>
            <Link href={`/posts/${post.slug}`} className="notes-list__row group">
              <span className="notes-list__meta" lang="vi">
                <time dateTime={post.date}>{formatPostDate(post.date, locale, "short")}</time>
                <span>{post.category}</span>
              </span>
              <span className="notes-list__text" lang="vi">
                <span className="notes-list__title">{post.title}</span>
                {post.excerpt ? <span className="notes-list__excerpt">{post.excerpt}</span> : null}
              </span>
              {post.cover ? (
                // eslint-disable-next-line @next/next/no-img-element -- local static asset
                <img className="notes-list__thumb" src={post.cover} alt="" loading="lazy" decoding="async" />
              ) : (
                <span className="notes-list__thumb" aria-hidden />
              )}
            </Link>
          </li>
        ))}
      </ol>
      <Link href="/posts" className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-accent hover:underline">
        {dict.posts.allNotes} ({posts.length})
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </div>
  );
}
