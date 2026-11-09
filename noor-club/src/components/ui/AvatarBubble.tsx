import { avatarGlyph, avatarTint } from "@/lib/avatars";
import { cn } from "@/lib/cn";

const SIZES = {
  sm: "h-10 w-10 text-xl",
  md: "h-14 w-14 text-3xl",
  lg: "h-20 w-20 text-4xl",
} as const;

export function AvatarBubble({
  avatar,
  name,
  size = "md",
  className,
}: {
  avatar: string;
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full",
        avatarTint(avatar),
        SIZES[size],
        className,
      )}
      role="img"
      aria-label={name}
    >
      <span aria-hidden="true">{avatarGlyph(avatar)}</span>
    </span>
  );
}
