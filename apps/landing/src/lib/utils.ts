/**
 * Class joining, without tailwind-merge.
 *
 * `apps/web` needs the merge because shadcn components take a `className` that
 * has to beat their own defaults. Nothing here does: every component on this
 * page owns its classes outright, so conflicts are a bug to fix rather than a
 * case to resolve at runtime.
 */
export function cn(
  ...values: (string | false | null | undefined)[]
): string | undefined {
  const joined = values.filter(Boolean).join(" ");
  return joined.length > 0 ? joined : undefined;
}
