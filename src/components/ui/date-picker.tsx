"use client";

import { cn } from "cn";
import { CalendarIcon } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * The stored value is an IST wall-clock date ("2026-10-08"), so it is read and
 * written through the browser's *local* date fields only. Routing it through
 * UTC would move the day by one for anyone whose clock isn't on IST.
 */
function parseValue(value: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return undefined;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

const toValue = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const LABEL_FORMAT = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

type CalendarProps = React.ComponentProps<typeof Calendar>;

/**
 * A date field backed by the shadcn Calendar in a popover. Unlike the native
 * field it reads the same on every browser, and the whole row is the target,
 * which is what a thumb needs.
 */
function DatePicker({
  id,
  value,
  onChange,
  placeholder = "Pick a date",
  disabled,
  className,
  ...calendar
}: {
  id?: string;
  /** "YYYY-MM-DD", or "" when nothing is picked yet. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
} & Pick<CalendarProps, "captionLayout" | "startMonth" | "endMonth" | "defaultMonth" | "required">) {
  const [open, setOpen] = React.useState(false);
  const selected = parseValue(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          // Inside a form an unqualified button submits it.
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn("w-full justify-start px-3 font-normal", !selected && "text-muted-foreground", className)}
        >
          <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{selected ? LABEL_FORMAT.format(selected) : placeholder}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          autoFocus
          defaultMonth={selected}
          {...calendar}
          selected={selected}
          onSelect={(d) => {
            if (!d) return;
            onChange(toValue(d));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

export { DatePicker };
