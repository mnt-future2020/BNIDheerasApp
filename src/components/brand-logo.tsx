import Image from "next/image";
import icon from "@/assets/dheeras-app-icon.png";
import { cn } from "@/lib/utils";

/**
 * The chapter's app icon (the glossy WE ARE / DHEERAS tile), drawn `height`
 * CSS pixels tall. It is square, so the width matches; `max-w-full` with
 * `h-auto` lets it scale down inside a narrow container — pass a responsive
 * height class to choose a size per breakpoint.
 */
export function BrandLogo({ height, preload, className }: { height: number; preload?: boolean; className?: string }) {
  return (
    <Image
      src={icon}
      alt="We Are Dheeras"
      height={height}
      width={height}
      preload={preload}
      className={cn("h-auto max-w-full", className)}
    />
  );
}
