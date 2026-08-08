import React from "react";
import { cn } from "../../lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Standard information containers or richer activity/action surfaces. */
  variant?: "standard" | "activity";
  /** Adds a subtle hover lift — use for clickable cards. */
  interactive?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "standard", interactive, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        // Uniform borders with ambient shadows only—neither variant has a heavy lower edge.
        "rounded-3xl border-2 border-[#E7E3F6] bg-white text-[#0E0B55] dark:border-white/10 dark:bg-[#171B2E] dark:text-[#E2E0F2]",
        variant === "standard" && "shadow-[0_6px_24px_rgba(83,74,183,0.06)] dark:shadow-none",
        variant === "activity" && "shadow-[0_10px_30px_-20px_rgba(83,74,183,0.28)] dark:shadow-[0_10px_30px_-20px_rgba(0,0,0,0.5)]",
        interactive && "cursor-pointer transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-[#DCD5F2] hover:shadow-[0_12px_32px_-20px_rgba(83,74,183,0.34)] dark:hover:border-white/15 dark:hover:shadow-[0_12px_32px_-20px_rgba(0,0,0,0.56)]",
        className
      )}
      {...props}
    />
  )
);
Card.displayName = "Card";

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col space-y-1.5 p-6", className)}
      {...props}
    />
  )
);
CardHeader.displayName = "CardHeader";

export const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn("font-semibold leading-none tracking-tight text-slate-900", className)}
      {...props}
    />
  )
);
CardTitle.displayName = "CardTitle";

export const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn("text-xs text-slate-500", className)}
      {...props}
    />
  )
);
CardDescription.displayName = "CardDescription";

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  )
);
CardContent.displayName = "CardContent";

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex items-center p-6 pt-0 border-t border-slate-100/50 mt-4", className)}
      {...props}
    />
  )
);
CardFooter.displayName = "CardFooter";
