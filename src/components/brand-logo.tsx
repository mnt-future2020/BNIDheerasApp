import Image from "next/image";
import logo from "@/assets/bni-dheeras-logo.png";

/** The chapter logo (WE ARE over DHEERAS), drawn `height` CSS pixels tall. */
export function BrandLogo({ height, preload, className }: { height: number; preload?: boolean; className?: string }) {
  return (
    <Image
      src={logo}
      alt="We Are Dheeras"
      height={height}
      width={Math.round((height * logo.width) / logo.height)}
      preload={preload}
      className={className}
    />
  );
}
