import Image from "next/image";
import logo from "@/assets/bni-dheeras-logo.png";
import { cn } from "@/lib/utils";

/**
 * The chapter logo (WE ARE over DHEERAS), drawn `height` CSS pixels tall.
 *
 * `height` is the intent, not a floor: the mark is a wide, short lockup, so on a
 * narrow phone the width is what runs out first. `max-w-full` with `h-auto`
 * lets it scale down inside whatever it is placed in rather than pushing the
 * page sideways — pass a responsive height class to choose a size per breakpoint.
 */
export function BrandLogo({ height, preload, className }: { height: number; preload?: boolean; className?: string }) {
  return (
    <Image
      src={logo}
      alt="We Are Dheeras"
      height={height}
      width={Math.round((height * logo.width) / logo.height)}
      preload={preload}
      className={cn("h-auto max-w-full", className)}
    />
  );
}
