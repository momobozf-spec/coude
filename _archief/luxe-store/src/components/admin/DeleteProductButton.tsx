"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export default function DeleteProductButton({
  productId,
}: {
  productId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this product?")) return;

    setLoading(true);
    await fetch(`/api/admin/products/${productId}`, { method: "DELETE" });
    router.refresh();
    setLoading(false);
  };

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50 cursor-pointer"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
