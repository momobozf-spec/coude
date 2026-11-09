"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const statuses = ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];

export default function OrderStatusSelect({
  orderId,
  currentStatus,
}: {
  orderId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleChange = async (status: string) => {
    setLoading(true);
    await fetch(`/api/admin/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    router.refresh();
    setLoading(false);
  };

  return (
    <select
      value={currentStatus}
      onChange={(e) => handleChange(e.target.value)}
      disabled={loading}
      className={`text-xs font-medium px-2.5 py-1 rounded-full border-none cursor-pointer focus:ring-2 focus:ring-ring ${
        currentStatus === "DELIVERED"
          ? "bg-emerald-100 text-emerald-800"
          : currentStatus === "SHIPPED"
          ? "bg-blue-100 text-blue-800"
          : currentStatus === "CANCELLED"
          ? "bg-red-100 text-red-800"
          : currentStatus === "PROCESSING"
          ? "bg-violet-100 text-violet-800"
          : "bg-amber-100 text-amber-800"
      }`}
    >
      {statuses.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}
