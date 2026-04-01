import { Metadata } from "next";
import Link from "next/link";
import { BLOG_POSTS } from "@/lib/blog";
import { breadcrumbSchema } from "@/lib/seo/schemas";

export const metadata: Metadata = {
  title: "Blog — Islamic Education Tips & Free Printables",
  description: "Tips for Islamic education, homeschooling, and raising Muslim kids. Free printable worksheets, Ramadan activity ideas, and Arabic learning resources.",
};

export default function BlogIndex() {
  const crumbs = breadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Blog", url: "/blog" },
  ]);

  return (
    <div className="min-h-screen flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }} />

      <nav className="bg-white/95 backdrop-blur border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
          <Link href="/" className="text-xl font-bold" style={{ color: "#0d9488" }}>Noor Printables</Link>
          <div className="flex gap-2">
            <Link href="/login" className="btn-secondary text-sm">Log in</Link>
            <Link href="/register" className="btn-primary text-sm">Start Free</Link>
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-12">
        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Blog</h1>
        <p className="text-gray-500 mb-10">Islamic education tips, free printables, and parenting resources.</p>

        <div className="space-y-8">
          {BLOG_POSTS.map((post) => (
            <Link key={post.slug} href={`/blog/${post.slug}`} className="block group">
              <article className="card hover:shadow-md transition-all">
                <div className="flex items-center gap-3 text-xs text-gray-400 mb-2">
                  <time>{new Date(post.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</time>
                  <span>&middot;</span>
                  <span>{post.readTime} read</span>
                </div>
                <h2 className="text-lg font-bold text-gray-900 group-hover:text-teal-700 transition-colors mb-2">
                  {post.title}
                </h2>
                <p className="text-sm text-gray-500">{post.description}</p>
              </article>
            </Link>
          ))}
        </div>
      </main>

      <footer className="text-center py-6 text-sm text-gray-400">
        Noor Printables &copy; 2026
      </footer>
    </div>
  );
}
