import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Apple-HIG inspired button. Hairlines are drawn with `ring` (box-shadow) rather
 * than `border`, because the global reset forces `border-color: transparent`.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold leading-none transition-all outline-none select-none shrink-0 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[18px] focus-visible:ring-2 focus-visible:ring-ring/60 active:scale-[0.97]",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-soft-sm hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground shadow-soft-sm hover:bg-destructive/90 focus-visible:ring-destructive/40",
        outline:
          "bg-transparent text-foreground ring-1 ring-inset ring-border hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/70",
        ghost:
          "bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground",
        link: "bg-transparent text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5 py-2 has-[>svg]:px-4",
        sm: "h-9 gap-1.5 px-3.5 text-[13px]",
        lg: "h-12 px-7 text-[15px]",
        icon: "size-10",
        "icon-sm": "size-9",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
