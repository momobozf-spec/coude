import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "new" | "sale" | "bestseller" | "soldout";
  className?: string;
}

export default function Badge({ children, variant = "default", className }: BadgeProps) {
  const variants = {
    default: "bg-muted text-foreground",
    new: "bg-emerald text-white",
    sale: "bg-burgundy text-white",
    bestseller: "bg-gold text-white",
    soldout: "bg-espresso/80 text-white backdrop-blur-sm",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider shadow-sm",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
