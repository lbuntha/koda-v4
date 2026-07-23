import React from "react";
import { cn } from "../../lib/utils";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  shape?: "block" | "line" | "circle";
}

export const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ shape = "block", className, ...props }, ref) => (
    <div
      ref={ref}
      aria-hidden="true"
      className={cn(
        "animate-pulse bg-[#EEEAF8] motion-reduce:animate-none",
        shape === "block" && "rounded-xl",
        shape === "line" && "h-3 rounded-full",
        shape === "circle" && "rounded-full",
        className,
      )}
      {...props}
    />
  ),
);
Skeleton.displayName = "Skeleton";

export interface SkeletonTextProps extends React.HTMLAttributes<HTMLDivElement> {
  lines?: number;
}

export const SkeletonText: React.FC<SkeletonTextProps> = ({ lines = 2, className, ...props }) => (
  <div className={cn("space-y-2", className)} aria-hidden="true" {...props}>
    {Array.from({ length: lines }, (_, index) => (
      <Skeleton key={index} shape="line" className={index === lines - 1 && lines > 1 ? "w-2/3" : "w-full"} />
    ))}
  </div>
);

export const SkeletonCard = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-2xl border border-[#E7E3F6] bg-white p-4 shadow-[0_6px_24px_rgba(83,74,183,0.06)] sm:p-5 md:p-6",
        className,
      )}
      {...props}
    />
  ),
);
SkeletonCard.displayName = "SkeletonCard";
