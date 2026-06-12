"use client";

import { useToast } from "@/lib/store";
import { Check } from "lucide-react";

export default function Toast() {
  const message = useToast((s) => s.message);
  if (!message) return null;
  return (
    <div className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 animate-slide-up">
      <div className="flex items-center gap-3 rounded-full bg-olive-700 px-5 py-3 text-cream-50 shadow-warm">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-cream-100 text-olive-700">
          <Check size={13} strokeWidth={2.2} />
        </span>
        <span className="text-sm tracking-wide">{message}</span>
      </div>
    </div>
  );
}
