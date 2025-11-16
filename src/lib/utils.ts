// src/lib/utils.ts
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges Tailwind CSS class names conditionally.
 * Example:
 *   cn("bg-red-500", isActive && "text-white")
 */
export function cn(...inputs: unknown[]) {
  return twMerge(clsx(inputs));
}
