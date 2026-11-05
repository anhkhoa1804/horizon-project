import type { Metadata } from "next";
import { getI18n } from "@/lib/i18n/server";
import { PublicShell } from "@/components/layout/public-shell";
import { PostTile } from "@/components/blog/post-tile";
import { KeywordTitle } from "@/components/ui/keyword-title";
import { getAllPosts } from "@/lib/content/posts";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.posts.indexTitle, description: dict.posts.indexLead };
}

export default async function PostsIndexPage() {
  const { dict, locale } = await getI18n();
  const posts = getAllPosts();
  // After the opening block (one large + four small), notes run two to a row; an odd last one spans the row.
  const wide = (i: number) => i >= 5 && i === posts.length - 1 && (posts.length - 5) % 2 === 1;

  return (
    <PublicShell activePath="/">
      <div className="py-10 md:py-16">
        <header className="chapter-heading h-text">
          <span className="chapter-eyebrow">{dict.posts.indexEyebrow}</span>
          <h1 className="chapter-heading__title">
            <KeywordTitle text={dict.posts.indexTitle} keyword={dict.posts.indexKeyword} />
          </h1>
          <p className="mt-4 text-muted">{dict.posts.indexLead}</p>
        </header>

        <div className="h-media mt-12">
          {posts.length === 0 ? (
            <p className="text-sm text-muted">{dict.notes.emptyLong}</p>
          ) : (
            <div className="tile-grid">
              {posts.map((post, i) => (
                <PostTile
                  key={post.slug}
                  post={post}
                  locale={locale}
                  large={i === 0}
                  className={i === 0 ? "tile-grid__hero" : i >= 5 ? (wide(i) ? "tile-grid__full" : "tile-grid__half") : undefined}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </PublicShell>
  );
}
