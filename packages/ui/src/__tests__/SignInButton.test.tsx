import { describe, it, expect, jest } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ClavexProvider } from "@clavex/react";
import { SignInButton } from "../components/SignInButton.js";

function button(props: React.ComponentProps<typeof SignInButton> = {}) {
  return render(<ClavexProvider issuer="https://issuer.example/acme" clientId="test-client"><SignInButton {...props} /></ClavexProvider>);
}

describe("SignInButton", () => {
  it("requires the authentication provider", () => {
    const silence = jest.spyOn(console, "error").mockImplementation(() => {});
    try { expect(() => render(<SignInButton />)).toThrow(); }
    finally { silence.mockRestore(); }
  });
  it("honours a disabled sign-in action", () => {
    const errors = jest.fn();
    button({disabled: true, children: "Company sign in", onError: errors});
    const target = screen.getByRole("button", {name: "Company sign in"}) as HTMLButtonElement;
    expect(target.disabled).toBe(true);
    fireEvent.click(target);
    expect(errors).not.toHaveBeenCalled();
  });
});
