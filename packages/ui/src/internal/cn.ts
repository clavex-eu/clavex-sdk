/** Simple class-name merge utility — avoids a tailwind-merge dependency. */
export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}
