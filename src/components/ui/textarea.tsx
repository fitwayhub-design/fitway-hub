import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-20 w-full rounded-md bg-muted px-4 py-3 text-[15px] text-foreground transition-[box-shadow,background-color] outline-none ring-1 ring-inset ring-border field-sizing-content",
        "placeholder:text-muted-foreground",
        "disabled:pointer-events-none disabled:opacity-50",
        "focus-visible:ring-2 focus-visible:ring-ring/70",
        "aria-invalid:ring-2 aria-invalid:ring-destructive/60",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
