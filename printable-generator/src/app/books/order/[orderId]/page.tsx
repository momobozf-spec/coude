"use client";

import Link from "next/link";
import { use } from "react";

export default function OrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params);

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#faf9f5" }}>
      <div className="card max-w-md w-full text-center">
        <div className="text-5xl mb-4">&#10003;</div>
        <h1 className="text-2xl font-bold mb-2" style={{ color: "#1a6b4a" }}>JazakAllahu Khairan!</h1>
        <p className="text-gray-600 mb-6">Your book order has been placed successfully.</p>

        <div className="p-4 rounded-lg mb-6 text-left text-sm" style={{ backgroundColor: "#e8f5ec" }}>
          <p className="font-bold mb-2" style={{ color: "#1a6b4a" }}>What happens next?</p>
          <div className="space-y-2 text-gray-600">
            <p>&#10003; Order placed <span className="text-gray-400">&mdash; now</span></p>
            <p>&#9711; Sent to printer <span className="text-gray-400">&mdash; within 24h</span></p>
            <p>&#9711; Production <span className="text-gray-400">&mdash; 2-4 days</span></p>
            <p>&#9711; Shipped <span className="text-gray-400">&mdash; tracking email sent</span></p>
            <p>&#9711; Delivered <span className="text-gray-400">&mdash; 5-10 days</span></p>
          </div>
        </div>

        <p className="text-xs text-gray-400 mb-4">Order ID: {orderId}</p>

        <div className="flex gap-2">
          <Link href="/books/create" className="btn-primary flex-1 text-center" style={{ backgroundColor: "#1a6b4a" }}>Create Another</Link>
          <Link href="/dashboard" className="btn-outline flex-1 text-center">Dashboard</Link>
        </div>
      </div>
    </div>
  );
}
