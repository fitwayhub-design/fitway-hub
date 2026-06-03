import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * iOS-style filled input — a soft surface fill, hairline ring, and a focus ring
 * in the brand accent. No heavy border (per the design language).
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-11 w-full min-w-0 rounded-md bg-muted px-4 py-2 text-[15px] text-foreground transition-[box-shadow,background-color] outline-none ring-1 ring-inset ring-border",
        "placeholder:text-muted-foreground",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        "disabled:pointer-events-none disabled:opacity-50",
        "focus-visible:ring-2 focus-visible:ring-ring/70",
        "aria-invalid:ring-2 aria-invalid:ring-destructive/60",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
