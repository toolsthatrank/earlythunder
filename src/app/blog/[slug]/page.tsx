import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { getAllBlogPosts, getBlogPostBySlug, getRelatedArticles } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { getBlogPostMetadata } from "@/lib/metadata";
import { getArticleSchema, getBreadcrumbListSchema } from "@/lib/structured-data";
import RelatedArticles from "@/components/RelatedArticles";
import WorkbenchCTA from "@/components/WorkbenchCTA";
import { SupportResultCard } from "@/components/SupportCta";

interface PageProps {
  readonly params: Promise<{ slug: string }>;
}

export function generateStaticParams(): { slug: string }[] {
  const posts = getAllBlogPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);
  if (!post) return { title: "Not Found" };

  return getBlogPostMetadata(post);
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);

  if (!post) {
    return <NotFoundFallback />;
  }

  const articleSchema = getArticleSchema(post);
  const breadcrumbSchema = getBreadcrumbListSchema([
    { name: "Home", path: "/" },
    { name: "Blog", path: "/blog" },
    { name: post.title, path: `/blog/${post.slug}` },
  ]);

  return (
    <article className="mx-auto max-w-3xl px-6 py-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <BackLink />
      <PostHeader
        title={post.title}
        date={post.published_at}
        author={post.author}
        tags={post.tags}
      />
      <PostContent content={post.content} />
      <WorkbenchCTA
        placement="blog"
        heading="Keep the evidence behind what you just read."
        body="The Token Evidence Workbench keeps the source and date of each figure beside your own assumptions, and exports a research memo you can revisit."
      />
      <SupportResultCard
        heading="Now you have the numbers behind this post."
      />
      <RelatedArticles
        items={getRelatedArticles(post, getAllBlogPosts())}
        basePath="/blog"
        heading="Related research"
      />
      <PostFooter />
    </article>
  );
}

function NotFoundFallback() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20 text-center">
      <h1 className="text-2xl font-semibold tracking-tighter text-text-primary">
        Post Not Found
      </h1>
      <p className="mt-2 text-text-secondary">
        This blog post does not exist or has been removed.
      </p>
      <Link
        href="/blog"
        className="mt-4 inline-block text-sm text-text-secondary hover:text-text-primary"
      >
        Back to blog
      </Link>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/blog"
      className="text-xs font-mono text-text-tertiary hover:text-text-secondary"
    >
      Blog
    </Link>
  );
}

function PostHeader({
  title,
  date,
  author,
  tags,
}: {
  readonly title: string;
  readonly date: string;
  readonly author: string;
  readonly tags: readonly string[];
}) {
  if (typeof title !== "string" || title.length === 0) return null;

  return (
    <header className="mt-6">
      <h1 className="text-4xl font-semibold tracking-tighter leading-tight text-text-primary">
        {title}
      </h1>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-text-tertiary">
        <span>{author}</span>
        <span className="text-border">|</span>
        <time>{formatDate(date)}</time>
      </div>
      {Array.isArray(tags) && tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-bg-card px-3 py-1 text-xs text-text-tertiary"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
      <div className="divider mt-8" />
    </header>
  );
}

const URL_PATTERN = /(https?:\/\/[^\s)]+)/g;
const BOLD_PATTERN = /\*\*([^*]+)\*\*/g;

/** Renders inline markdown: **bold** and bare https links. */
function InlineText({ text }: { readonly text: string }) {
  const nodes: ReactNode[] = [];
  const segments = text.split(BOLD_PATTERN);

  segments.forEach((segment, i) => {
    const isBold = i % 2 === 1;
    const parts = segment.split(URL_PATTERN);
    const rendered = parts.map((part, j) => {
      if (URL_PATTERN.test(part)) {
        URL_PATTERN.lastIndex = 0;
        const label = part.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
        return (
          <a
            key={`${i}-${j}`}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber underline decoration-amber/40 underline-offset-2 hover:decoration-amber break-words"
          >
            {label}
          </a>
        );
      }
      URL_PATTERN.lastIndex = 0;
      return part;
    });
    if (isBold) {
      nodes.push(
        <strong key={i} className="font-semibold text-text-primary">
          {rendered}
        </strong>,
      );
    } else {
      nodes.push(...rendered);
    }
  });

  return <>{nodes}</>;
}

function isListBlock(block: string): boolean {
  const lines = block.split("\n");
  return lines.length > 0 && lines.every((l) => /^(- |\d+\. )/.test(l.trim()));
}

function PostContent({ content }: { readonly content: string }) {
  if (typeof content !== "string" || content.length === 0) return null;

  const blocks = content.split("\n\n").slice(0, 100);

  return (
    <div className="mt-10">
      {blocks.map((block, i) => {
        const trimmed = block.trim();

        if (trimmed.startsWith("### ")) {
          return (
            <h3
              key={i}
              className="mt-10 mb-4 text-lg font-semibold tracking-tight text-text-primary"
            >
              <InlineText text={trimmed.slice(4)} />
            </h3>
          );
        }

        if (trimmed.startsWith("## ")) {
          return (
            <h2
              key={i}
              className="mt-12 mb-4 text-2xl font-semibold tracking-tight text-text-primary"
            >
              <InlineText text={trimmed.slice(3)} />
            </h2>
          );
        }

        if (isListBlock(trimmed)) {
          const items = trimmed.split("\n").map((l) => l.trim());
          const ordered = /^\d+\. /.test(items[0]);
          const ListTag = ordered ? "ol" : "ul";
          return (
            <ListTag
              key={i}
              className={`my-5 space-y-2.5 pl-5 text-[1.0625rem] leading-relaxed text-text-secondary ${
                ordered ? "list-decimal" : "list-disc"
              } marker:text-text-tertiary`}
            >
              {items.map((item, j) => (
                <li key={j} className="pl-1">
                  <InlineText text={item.replace(/^(- |\d+\. )/, "")} />
                </li>
              ))}
            </ListTag>
          );
        }

        return (
          <p
            key={i}
            className="my-5 text-[1.0625rem] leading-[1.8] text-text-secondary"
          >
            <InlineText text={trimmed} />
          </p>
        );
      })}
    </div>
  );
}

function PostFooter() {
  return (
    <div className="mt-16 border-t border-border pt-8 text-center">
      <p className="text-sm text-text-tertiary">
        The research is free. The Workbench is $29 once.
      </p>
      <Link
        href="/pricing"
        className="mt-4 inline-block rounded-full bg-amber px-6 py-3 text-sm font-semibold text-black transition-all duration-150 hover:bg-amber-hover hover:-translate-y-0.5 hover:shadow-[0_4px_14px_rgba(245,166,35,0.28)]"
      >
        See pricing
      </Link>
    </div>
  );
}
