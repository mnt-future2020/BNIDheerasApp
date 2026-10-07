"use client";

import { cn } from "cn";
import { ClockIcon } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

const pad = (n: number) => String(n).padStart(2, "0");
/** 12 leads, the way a clock face reads — 12:30 AM is half past midnight. */
const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const PERIODS = ["AM", "PM"] as const;
type Period = (typeof PERIODS)[number];

/** "19:30" → 24-hour parts, or null while the field is still empty. */
function parseValue(value: string) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

/**
 * A time field built from the shadcn popover and scroll area: hour, minute and
 * AM/PM as three columns of buttons. The chapter reads times as "7:00 AM", so
 * the field shows that while still storing the 24-hour "HH:MM" the server wants.
 */
function TimePicker({
  id,
  value,
  onChange,
  placeholder = "Pick a time",
  minuteStep = 5,
  disabled,
  className,
}: {
  id?: string;
  /** "HH:MM" in 24-hour form, or "" when nothing is picked yet. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Minutes offered in the list. Any minute already stored is added to it. */
  minuteStep?: number;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const parsed = parseValue(value);
  // Empty starts at midnight, so picking only an hour gives a whole hour AM.
  const minute = parsed?.minute ?? 0;
  const hour24 = parsed?.hour ?? 0;
  const period: Period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;

  const minutes = React.useMemo(() => {
    const list: number[] = [];
    for (let i = 0; i < 60; i += Math.max(1, minuteStep)) list.push(i);
    // An existing meeting at 7:12 must reopen as 7:12, not be rounded away.
    if (!list.includes(minute)) list.push(minute);
    return list.sort((a, b) => a - b);
  }, [minuteStep, minute]);

  const emit = (h12: number, m: number, p: Period) => onChange(`${pad(p === "AM" ? h12 % 12 : (h12 % 12) + 12)}:${pad(m)}`);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          // Inside a form an unqualified button submits it.
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn("w-full justify-start px-3 font-normal", !parsed && "text-muted-foreground", className)}
        >
          <ClockIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{parsed ? `${hour12}:${pad(minute)} ${period}` : placeholder}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        <div className="flex gap-1">
          <Column
            label="Hour"
            items={HOURS}
            selected={parsed ? hour12 : null}
            format={String}
            onSelect={(h) => emit(h, minute, period)}
          />
          <Column label="Min" items={minutes} selected={parsed ? minute : null} format={pad} onSelect={(m) => emit(hour12, m, period)} />
          <div className="flex w-14 flex-col gap-1">
            <ColumnLabel>AM/PM</ColumnLabel>
            {PERIODS.map((p) => (
              <Item key={p} active={parsed ? p === period : false} onSelect={() => emit(hour12, minute, p)}>
                {p}
              </Item>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ColumnLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-center text-[11px] font-medium text-muted-foreground uppercase">{children}</div>;
}

function Item({ active, onSelect, children }: { active: boolean; onSelect: () => void; children: React.ReactNode }) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "ghost"}
      data-active={active}
      className="w-full shrink-0 justify-center font-normal tabular-nums"
      onClick={onSelect}
    >
      {children}
    </Button>
  );
}

function Column({
  label,
  items,
  selected,
  format,
  onSelect,
}: {
  label: string;
  items: number[];
  selected: number | null;
  format: (n: number) => string;
  onSelect: (n: number) => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  // The popover mounts fresh each time it opens, so this runs once per opening:
  // it lands on what is already chosen rather than at the top of the list.
  React.useEffect(() => {
    const viewport = ref.current?.querySelector<HTMLElement>("[data-slot=scroll-area-viewport]");
    const active = viewport?.querySelector<HTMLElement>("[data-active=true]");
    if (!viewport || !active) return;
    viewport.scrollTop = active.offsetTop - viewport.clientHeight / 2 + active.clientHeight / 2;
  }, []);

  return (
    <div className="flex flex-col gap-1">
      <ColumnLabel>{label}</ColumnLabel>
      <ScrollArea ref={ref} className="h-52 w-14">
        <div className="flex flex-col gap-1 pr-2.5">
          {items.map((n) => (
            <Item key={n} active={n === selected} onSelect={() => onSelect(n)}>
              {format(n)}
            </Item>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

export { TimePicker };
