"use client";

import { cn } from "cn";
import { CalendarIcon, ClockIcon } from "lucide-react";
import * as React from "react";

/**
 * A date or time field with its own icon. The browser only opens the picker
 * from its small indicator; here the whole row is the target, which is what a
 * thumb needs. Falls back to the native field wherever showPicker is missing.
 */
function DateTimeInput({
  className,
  type,
  onClick,
  ...props
}: Omit<React.ComponentProps<"input">, "type"> & { type: "date" | "time" }) {
  const ref = React.useRef<HTMLInputElement>(null);
  const Icon = type === "date" ? CalendarIcon : ClockIcon;
  return (
    <div className="relative w-full">
      <Icon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground peer-focus-visible:text-primary" />
      <input
        ref={ref}
        type={type}
        data-slot="input"
        onClick={(e) => {
          onClick?.(e);
          if (e.defaultPrevented) return;
          // Throws when the browser doesn't count this as a user gesture; the
          // native indicator still works, so there is nothing to recover from.
          try {
            ref.current?.showPicker?.();
          } catch {}
        }}
        className={cn(
          "peer h-9 w-full min-w-0 cursor-pointer rounded-lg border border-input bg-background py-1 pr-3 pl-9 text-base shadow-xs transition-colors outline-none hover:border-foreground/20 hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-date-and-time-value]:text-left",
          className,
        )}
        {...props}
      />
    </div>
  );
}

export { DateTimeInput };
