/**
 * iOS launch screens for the installed app, one per screen size. iOS only uses
 * an image whose media query matches the device exactly, so each is listed
 * with its size in points and pixel ratio. The PNGs are built by
 * scripts/make-icons.py from the same list.
 */
import { iconUrl } from "@/lib/app-icons";

const SCREENS: [width: number, height: number, ratio: number][] = [
  [440, 956, 3],
  [430, 932, 3],
  [428, 926, 3],
  [414, 896, 3],
  [414, 896, 2],
  [414, 736, 3],
  [402, 874, 3],
  [393, 852, 3],
  [390, 844, 3],
  [375, 812, 3],
  [375, 667, 2],
  [320, 568, 2],
  [1032, 1376, 2],
  [1024, 1366, 2],
  [834, 1210, 2],
  [834, 1194, 2],
  [834, 1112, 2],
  [820, 1180, 2],
  [810, 1080, 2],
  [768, 1024, 2],
  [744, 1133, 2],
];

export const SPLASH_SCREENS = SCREENS.map(([w, h, ratio]) => ({
  url: iconUrl(`/splash/splash-${w * ratio}x${h * ratio}.png`),
  media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${ratio}) and (orientation: portrait)`,
}));
