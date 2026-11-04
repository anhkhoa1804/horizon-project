import Link from "next/link";
import type { PostMeta } from "@/lib/content/posts";
import type { Locale } from "@/lib/i18n/config";
import { formatPostDate } from "@/lib/content/postFormat";
import { cn } from "@/lib/utils";

/**
 * A note as a photograph tile - the same visual language as the home gallery (rounded image, title
 * laid on a soft bottom gradient). One link, one tab stop, named by the title; the image is decorative.
 */
export function PostTile({
  post,
  locale,
  className,
  large = false,
}: {
  post: PostMeta;
  locale: Locale;
  className?: string;
  large?: boolean;
}) {
  return (
    <Link href={`/posts/${post.slug}`} className={cn("post-tile group", large && "post-tile--large", className)}>
      {post.cover ? (
        // eslint-disable-next-line @next/next/no-img-element -- local static asset
        <img src={post.cover} alt="" loading="lazy" decoding="async" />
      ) : (
        <span aria-hidden className="post-tile__blank" />
      )}
      <span className="post-tile__text" lang="vi">
        <span className="post-tile__meta">
          {post.category} · {formatPostDate(post.date, locale, "short")}
        </span>
        <span className="post-tile__title">{post.title}</span>
        {large && post.excerpt ? <span className="post-tile__excerpt">{post.excerpt}</span> : null}
      </span>
    </Link>
  );
}
