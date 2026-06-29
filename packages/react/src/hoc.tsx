/**
 * withAuthRequired — higher-order component that redirects unauthenticated
 * users to the Clavex sign-in page.
 *
 * @example
 * ```tsx
 * export default withAuthRequired(DashboardPage);
 *
 * // With custom options
 * export default withAuthRequired(DashboardPage, {
 *   returnTo: "/dashboard",
 *   onRedirecting: () => <FullPageSpinner />,
 * });
 * ```
 */
import React from "react";
import { useAuth } from "./hooks.js";

export function withAuthRequired<P extends object>(
  Component: React.ComponentType<P>,
  options?: {
    /** App state `returnTo` to pass after sign-in. Defaults to current pathname. */
    returnTo?: string;
    /** Node to render while loading / redirecting. */
    onRedirecting?: () => React.ReactNode;
  },
): React.FC<P> {
  const Wrapped: React.FC<P> = (props: P) => {
    const { isLoaded, isSignedIn, signIn } = useAuth();

    if (!isLoaded) {
      return (options?.onRedirecting?.() ?? null) as React.ReactElement | null;
    }

    if (!isSignedIn) {
      signIn({ appState: { returnTo: options?.returnTo ?? window.location.pathname } }).catch(
        console.error,
      );
      return (options?.onRedirecting?.() ?? null) as React.ReactElement | null;
    }

    return <Component {...props} />;
  };

  Wrapped.displayName = `withAuthRequired(${
    (Component as React.ComponentType<P> & { displayName?: string }).displayName ??
    Component.name ??
    "Component"
  })`;
  return Wrapped;
}
