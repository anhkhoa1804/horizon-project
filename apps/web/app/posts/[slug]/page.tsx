import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { PublicShell } from "@/components/layout/public-shell";
import { getAllPosts, getPost, getRelatedPosts, type PostStatus } from "@/lib/content/posts";
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

const STATUS_NOTE: Record<PostStatus, string | null> = {
  draft: "draft",
  demo: "demo",
  placeholder: "placeholder",
  verified: null,
};

function formatDate(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "long", year: "numeric" }).format(date);
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { dict } = await getI18n();
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const related = getRelatedPosts(slug, 3);
  const statusNote = STATUS_NOTE[post.status];

  return (
    <PublicShell activePath="/">
      <article className="py-6 md:py-10">
        <div className="mx-auto max-w-[var(--width-reading)]">
          <Link
            href="/#ghi-chep"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors duration-[var(--motion-base)] hover:text-accent"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {dict.posts.eyebrow}
          </Link>

          <header className="mt-8 space-y-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent">{post.category}</p>
            <h1 className="text-[length:var(--text-title-editorial)] font-semibold leading-tight tracking-tight">{post.title}</h1>
            <p className="text-sm text-muted">
              {formatDate(post.date)}
              {post.readingTime ? ` · ${post.readingTime}` : null}
            </p>
          </header>

          {statusNote ? (
            <p className="mt-8 border-l-2 border-watch/50 bg-watch-bg/50 px-4 py-3 text-sm text-watch">{statusNote}</p>
          ) : null}
        </div>

        {post.cover ? (
          <div className="mx-auto mt-10 max-w-[var(--width-content)]">
            {/* eslint-disable-next-line @next/next/no-img-element -- local static asset; next/image adds nothing for a committed SVG */}
            <img
              src={post.cover}
              alt=""
              className="w-full rounded-lg border border-border"
            />
          </div>
        ) : null}

        <div
          className="prose-horizon mx-auto mt-12 max-w-[var(--width-reading)]"
          // Source is a Markdown file committed to this repository and rendered
          // by lib/content/markdown.ts, which escapes all input before applying
          // its own small set of tags. No user-submitted content reaches here.
          dangerouslySetInnerHTML={{ __html: renderMarkdown(post.body) }}
        />

        {related.length > 0 ? (
          <aside className="mx-auto mt-24 max-w-[var(--width-content)] border-t border-border pt-10">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent">{dict.posts.otherNotes}</h2>
            <div className="mt-6 divide-y divide-border/60 border-y border-border/60">
              {related.map((item) => (
                <Link
                  key={item.slug}
                  href={`/posts/${item.slug}`}
                  className="group flex items-center gap-6 py-5 transition-colors duration-[var(--motion-base)] hover:bg-muted/20"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] uppercase tracking-[0.14em] text-muted">{item.category}</span>
                    <span className="mt-1 block text-lg font-semibold leading-snug tracking-tight">{item.title}</span>
                  </span>
                  <ArrowRight
                    className="h-4 w-4 shrink-0 text-muted transition-transform duration-[var(--motion-base)] group-hover:translate-x-1 group-hover:text-accent"
                    aria-hidden
                  />
                </Link>
              ))}
            </div>
          </aside>
        ) : null}
      </article>
    </PublicShell>
  );
}
