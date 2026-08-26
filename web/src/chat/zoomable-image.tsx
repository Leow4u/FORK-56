import { useState, type ComponentProps } from "react";

import { cn } from "@/lib/utils";

export interface ZoomableImageProps extends ComponentProps<"img"> {
  containerClassName?: string;
}

/** Click-to-lightbox image (desktop ZoomableImage subset for thin chat). */
export function ZoomableImage({
  className,
  containerClassName,
  src,
  alt,
  ...props
}: ZoomableImageProps) {
  const [open, setOpen] = useState(false);
  if (!src) return null;

  return (
    <>
      <button
        type="button"
        className={cn(
          "group/image relative block max-w-full overflow-hidden rounded-md",
          containerClassName,
        )}
        onClick={() => setOpen(true)}
        title="Open image"
      >
        <img
          alt={alt ?? ""}
          src={src}
          className={cn("max-h-64 max-w-full object-contain", className)}
          {...props}
        />
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal
          aria-label="Image preview"
          onClick={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
        >
          <img
            alt={alt ?? ""}
            src={src}
            className="max-h-full max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
