"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

interface Book { id: string; title: string; childName: string; status: string; variant: string; pageCount: number; coverColor: string; createdAt: string; }

export default function MyBooksPage() {
  const { data: session } = useSession();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In production, fetch from /api/books/my-books
    setLoading(false);
  }, []);

  if (!session) return <div className="min-h-screen flex items-center justify-center"><Link href="/login" className="btn-primary">Log in</Link></div>;

  return (
    <div className="min-h-screen" style={{ background: "#faf9f5" }}>
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
          <Link href="/books" className="text-sm text-gray-500">&larr; Books</Link>
          <span className="font-bold" style={{ color: "#1a6b4a" }}>My Books</span>
          <Link href="/books/create" className="btn-primary text-sm" style={{ backgroundColor: "#1a6b4a" }}>+ Create</Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {loading ? (
          <p className="text-gray-400">Loading...</p>
        ) : books.length === 0 ? (
          <div className="card text-center py-12">
            <div className="text-4xl mb-3">&#128214;</div>
            <p className="text-gray-500 mb-4">You haven&apos;t created any books yet.</p>
            <Link href="/books/create" className="btn-primary" style={{ backgroundColor: "#1a6b4a" }}>Create Your First Book</Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
            {books.map(b => (
              <div key={b.id} className="card">
                <div className="aspect-square rounded-lg mb-3 flex items-center justify-center text-white text-center p-4" style={{ backgroundColor: b.coverColor }}>
                  <div>
                    <p className="font-bold text-sm">{b.title}</p>
                    <p className="text-xs opacity-80">{b.childName}</p>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs px-2 py-0.5 rounded" style={{
                    backgroundColor: b.status === "shipped" ? "#e8f5ec" : b.status === "printing" ? "#fdf3d7" : "#f3f4f6",
                    color: b.status === "shipped" ? "#1a6b4a" : b.status === "printing" ? "#c9920a" : "#666",
                  }}>{b.status.toUpperCase()}</span>
                  <span className="text-xs text-gray-400">{b.pageCount}p</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
