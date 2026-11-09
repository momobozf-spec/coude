"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const statuses = [
  { value: "PENDING", label: "In afwachting", color: "bg-yellow-100 text-yellow-800" },
  { value: "PROCESSING", label: "In verwerking", color: "bg-blue-100 text-blue-800" },
  { value: "SHIPPED", label: "Verzonden", color: "bg-purple-100 text-purple-800" },
  { value: "DELIVERED", label: "Afgeleverd", color: "bg-green-100 text-green-800" },
  { value: "CANCELLED", label: "Geannuleerd", color: "bg-red-100 text-red-800" },
];

export default function OrderStatusSelect({
  orderId,
  currentStatus,
}: {
  orderId: string;
  currentStatus: string;
}) {
  const [status, setStatus] = useState(currentStatus);
  const [loading, setLoading] = useState(false);

  async function handleChange(newStatus: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setStatus(newStatus);
      } else {
        alert("Fout bij het bijwerken van de status");
      }
    } catch {
      alert("Fout bij het bijwerken van de status");
    } finally {
      setLoading(false);
    }
  }

  const current = statuses.find((s) => s.value === status);

  return (
    <select
      value={status}
      onChange={(e) => handleChange(e.target.value)}
      disabled={loading}
      className={cn(
        "rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer",
        current?.color,
        loading && "opacity-50 cursor-not-allowed"
      )}
    >
      {statuses.map((s) => (
        <option key={s.value} value={s.value}>
          {s.label}
        </option>
      ))}
    </select>
  );
}
