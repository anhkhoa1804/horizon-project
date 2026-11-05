import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { PublicShell } from "@/components/layout/public-shell";
import { getAllPosts, getPost, getRelatedPosts } from "@/lib/content/posts";
import { PostTile } from "@/components/blog/post-tile";
import { formatPostDate, readingTimeLabel } from "@/lib/content/postFormat";
import { renderMarkdown } from "@/lib/content/markdown";

/** Every post is a committed file, so the full set is known at build time. */
export function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  // No " — HORIZON" suffix here: the root layout's title template already
  // appends it. Spelling it out again produced "… — HORIZON — HORIZON".
  if (!post) return { title: (await getI18n()).dict.posts.notFound };
  return { title: post.title, description: post.excerpt };
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { dict, locale } = await getI18n();
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const related = getRelatedPosts(slug, 3);

  return (
    <PublicShell activePath="/">
      <article className="post-page py-10 md:py-14">
        <div className="h-media">
          <Link href="/posts" className="post-back">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            {dict.posts.allNotes}
          </Link>
          {/* Same opening box as the Report page: photograph, field-green surface, editorial title. */}
          <header className={post.cover ? "post-hero" : "post-hero post-hero--plain"} lang="vi">
            {post.cover ? (
              <div className="post-hero__art">
                {/* eslint-disable-next-line @next/next/no-img-element -- local static asset */}
                <img src={post.cover} alt="" />
              </div>
            ) : null}
            <div className="post-hero__text">
              <p className="post-hero__meta">
                <span>{post.category}</span>
                <span>{formatPostDate(post.date, locale)}</span>
                {post.readingTime ? <span>{readingTimeLabel(post.readingTime, dict.notes.minRead)}</span> : null}
              </p>
              <h1>{post.title}</h1>
              {post.excerpt ? <p className="post-hero__lead">{post.excerpt}</p> : null}
            </div>
          </header>
        </div>

        <div
          className="prose-horizon post-body h-text"
          lang="vi"
          // Source is a Markdown file committed to this repository and rendered
          // by lib/content/markdown.ts, which escapes all input before applying
          // its own small set of tags. No user-submitted content reaches here.
          dangerouslySetInnerHTML={{ __html: renderMarkdown(post.body) }}
        />

        {related.length > 0 ? (
          <aside className="post-related h-media">
            <p className="chapter-eyebrow">{dict.posts.readNext}</p>
            <div className="tile-grid tile-grid--row">
              {related.map((item) => (
                <PostTile key={item.slug} post={item} locale={locale} />
              ))}
            </div>
          </aside>
        ) : null}
      </article>
    </PublicShell>
  );
}
