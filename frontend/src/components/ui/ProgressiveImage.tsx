import React, { useState } from "react";
import { cn } from "../../lib/utils";
import { Skeleton } from "./ProgressiveSkeleton";

export interface ProgressiveImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  aspectRatio?: string;
}

/** Image loader with blur-up placeholder, shimmer fallback, and smooth fade-in */
export const ProgressiveImage: React.FC<ProgressiveImageProps> = ({
  src,
  alt,
  className = "",
  containerClassName = "",
  aspectRatio,
  ...props
}) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <div
      className={cn("relative overflow-hidden bg-slate-100 dark:bg-slate-800", containerClassName)}
      style={aspectRatio ? { aspectRatio } : undefined}
    >
      {!loaded && !error && (
        <Skeleton className="absolute inset-0 h-full w-full rounded-none" rounded="sm" />
      )}
      {error ? (
        <div className="flex h-full w-full items-center justify-center p-2 text-center text-xs font-medium text-slate-400">
          Image unavailable
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          className={cn(
            "h-full w-full object-cover transition-all duration-500 ease-out",
            loaded ? "opacity-100 scale-100 blur-0" : "opacity-0 scale-95 blur-sm",
            className,
          )}
          {...props}
        />
      )}
    </div>
  );
};
