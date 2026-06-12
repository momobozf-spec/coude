import clsx, { type ClassValue } from "clsx";

export const cn = (...args: ClassValue[]) => clsx(args);

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
