/* eslint-disable @next/next/no-img-element -- supplier image hosts are dynamic and not fully allowlisted. */
"use client";

import { ImageOff } from "lucide-react";
import { useState } from "react";
import { productImageSource } from "@/lib/ui/product-image";
import { cn } from "@/lib/ui/cn";

export type ProductThumbnailProps = {
  src: string | null | undefined;
  alt: string;
  size?: "md" | "lg" | "xl";
  className?: string;
  imageClassName?: string;
};

const sizeClasses = {
  md: "h-16 w-16",
  lg: "h-20 w-20",
  xl: "h-24 w-24"
};

export function ProductThumbnail({ src, alt, size = "md", className, imageClassName }: ProductThumbnailProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const imageSrc = productImageSource(src);
  const canRender = Boolean(imageSrc && failedSrc !== imageSrc);

  return (
    <span className={cn("grid shrink-0 place-items-center overflow-hidden rounded-card border border-border bg-surface-muted", sizeClasses[size], className)}>
      {canRender ? (
        <img
          src={imageSrc ?? undefined}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailedSrc(imageSrc ?? null)}
          className={cn("h-full w-full object-contain p-1.5", imageClassName)}
        />
      ) : (
        <span role={alt ? "img" : undefined} aria-label={alt ? `${alt} image unavailable` : undefined}>
          <ImageOff aria-hidden="true" className="h-6 w-6 text-muted" />
        </span>
      )}
    </span>
  );
}
