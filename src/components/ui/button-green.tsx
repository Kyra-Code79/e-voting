// components/ui/button.tsx
import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost";
}

export function Button({ className, variant = "default", ...props }: ButtonProps) {
  const base =
    "inline-flex items-center justify-center font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 disabled:opacity-50";
  const variants = {
    default: "bg-green-600 text-white hover:bg-green-700",
    outline: "border border-gray-500 text-gray-200 hover:bg-gray-800",
    ghost: "text-emerald-400 hover:bg-emerald-800/20",
  };

  return (
    <button className={cn(base, variants[variant], className)} {...props} />
  );
}
