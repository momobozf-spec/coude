import type { Review } from "@/types";
import { Stars } from "@/components/ui/Stars";
import { CheckCircle2 } from "lucide-react";

export function ReviewCard({ review }: { review: Review }) {
  return (
    <article className="rounded-2xl border border-cream-200 bg-cream-50 p-6">
      <Stars rating={review.rating} size={15} />
      <h4 className="mt-3 font-display text-lg leading-snug text-forest-800">
        {review.title}
      </h4>
      <p className="mt-2 text-sm leading-relaxed text-warmbrown-600">{review.body}</p>
      <div className="mt-4 flex items-center justify-between text-xs text-warmbrown-500">
        <span className="font-medium text-forest-700">{review.author}</span>
        <span className="flex items-center gap-1">
          {review.verified && (
            <span className="flex items-center gap-1 text-olive-600">
              <CheckCircle2 size={12} strokeWidth={1.6} /> Geverifieerd
            </span>
          )}
          <span className="opacity-50">·</span>
          <span>{review.country}</span>
        </span>
      </div>
    </article>
  );
}
