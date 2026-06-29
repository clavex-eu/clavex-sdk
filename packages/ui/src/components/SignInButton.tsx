/**
 * <SignInButton> — starts the PKCE authorization code flow on click.
 *
 * @example Basic usage
 * ```tsx
 * import { SignInButton } from "@clavex/ui";
 * <SignInButton />
 * ```
 *
 * @example Custom label + redirect
 * ```tsx
 * <SignInButton appState={{ returnTo: "/dashboard" }}>
 *   Log in to Acme
 * </SignInButton>
 * ```
 *
 * @example Step-up with acr_values
 * ```tsx
 * <SignInButton acrValues="2" className="my-btn">
 *   Sign in with MFA
 * </SignInButton>
 * ```
 */
import { type CSSProperties, type ReactNode } from "react";
import { useSignIn, type SignInOptions, type AppState } from "@clavex/react";
import { cn } from "../internal/cn.js";

export interface SignInButtonProps {
  /** Button label. Defaults to "Sign in". */
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Extra authorization parameters (e.g. `{ prompt: "login" }`). */
  authorizationParams?: Record<string, string>;
  /** App state restored after the redirect (passed to `onRedirectCallback`). */
  appState?: AppState;
  /** Pre-populate a login hint (email or username). */
  loginHint?: string;
  /**
   * Minimum ACR value to request (e.g. "2" forces MFA at the IdP level).
   * Mapped to the `acr_values` authorization parameter.
   */
  acrValues?: string;
  /** Make the button fill its container width. */
  fullWidth?: boolean;
  disabled?: boolean;
  /** Called after `signIn()` throws. */
  onError?: (error: Error) => void;
}

export function SignInButton({
  children = "Sign in",
  className,
  style,
  authorizationParams,
  appState,
  loginHint,
  acrValues,
  fullWidth = false,
  disabled = false,
  onError,
}: SignInButtonProps): React.JSX.Element {
  const { signIn, isLoading, error } = useSignIn();

  const handleClick = async () => {
    const options: SignInOptions = {};
    if (authorizationParams) options.authorizationParams = authorizationParams;
    if (appState) options.appState = appState;
    if (loginHint) options.loginHint = loginHint;
    if (acrValues) options.acrValues = acrValues;

    try {
      await signIn(options);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      onError?.(e);
    }
  };

  return (
    <button
      type="button"
      className={cn(
        "clavex-btn clavex-btn--primary",
        fullWidth && "clavex-signin-btn--full",
        className,
      )}
      style={style}
      onClick={handleClick}
      disabled={disabled || isLoading}
      data-loading={isLoading || undefined}
      data-clavex-ui=""
    >
      {isLoading ? <span className="clavex-spinner" aria-hidden /> : null}
      {children}
    </button>
  );
}
