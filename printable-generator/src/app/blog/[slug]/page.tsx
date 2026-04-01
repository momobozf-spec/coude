import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BLOG_POSTS } from "@/lib/blog";
import { articleSchema, breadcrumbSchema } from "@/lib/seo/schemas";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = BLOG_POSTS.find((p) => p.slug === slug);
  if (!post) return {};

  return {
    title: post.title,
    description: post.description,
    keywords: post.keywords,
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      publishedTime: post.date,
      url: `/blog/${post.slug}`,
      images: [`/api/og?title=${encodeURIComponent(post.title)}&subtitle=${encodeURIComponent(post.description.slice(0, 80))}`],
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = BLOG_POSTS.find((p) => p.slug === slug);
  if (!post) notFound();

  const article = articleSchema({
    title: post.title,
    description: post.description,
    url: `/blog/${post.slug}`,
    datePublished: post.date,
    dateModified: post.date,
  });

  const crumbs = breadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Blog", url: "/blog" },
    { name: post.title, url: `/blog/${post.slug}` },
  ]);

  return (
    <div className="min-h-screen flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(article) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }} />

      <nav className="bg-white/95 backdrop-blur border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 py-3 flex justify-between items-center">
          <Link href="/" className="text-xl font-bold" style={{ color: "#0d9488" }}>Noor Printables</Link>
          <div className="flex gap-2">
            <Link href="/blog" className="btn-outline text-sm">Blog</Link>
            <Link href="/register" className="btn-primary text-sm">Start Free</Link>
          </div>
        </div>
      </nav>

      {/* Breadcrumb */}
      <div className="max-w-3xl mx-auto px-4 py-3 text-xs text-gray-400">
        <Link href="/" className="hover:text-gray-600">Home</Link>
        <span className="mx-1">/</span>
        <Link href="/blog" className="hover:text-gray-600">Blog</Link>
        <span className="mx-1">/</span>
        <span className="text-gray-600">{post.title.slice(0, 50)}...</span>
      </div>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 pb-16">
        <article>
          <header className="mb-8">
            <div className="flex items-center gap-3 text-xs text-gray-400 mb-3">
              <time>{new Date(post.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</time>
              <span>&middot;</span>
              <span>{post.readTime} read</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 leading-tight">
              {post.title}
            </h1>
          </header>

          <div
            className="prose-article"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
        </article>

        {/* CTA */}
        <div className="mt-12 rounded-xl p-8 text-center" style={{ background: "linear-gradient(135deg, #0d9488, #0f766e)" }}>
          <h2 className="text-xl font-bold text-white mb-2">Try Noor Printables Free</h2>
          <p className="text-teal-100 text-sm mb-4">Generate Islamic coloring pages, mazes & word searches in seconds.</p>
          <Link href="/register" className="inline-flex items-center justify-center bg-white font-bold px-8 py-3 rounded-lg" style={{ color: "#0d9488" }}>
            Get 3 Free Worksheets &rarr;
          </Link>
        </div>
      </main>

      <footer className="text-center py-6 text-sm text-gray-400">
        Noor Printables &copy; 2026
      </footer>
    </div>
  );
}
