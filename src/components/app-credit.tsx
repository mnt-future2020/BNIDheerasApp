/**
 * Who built the app. On phones it sits under the bottom navigation, so it is
 * the last line on the screen; on a wide screen, where there is no bottom bar,
 * it closes the page instead.
 */
export function AppCredit({ className }: { className?: string }) {
  return (
    <p className={`text-center text-[10px] leading-none text-muted-foreground ${className ?? ""}`}>
      Developed by <span className="font-medium">MnT Future</span>
    </p>
  );
}
