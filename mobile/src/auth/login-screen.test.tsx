/* eslint-disable import/first -- the auth hook mock must be registered before the screen import */
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { describe, expect, it } from "@jest/globals";

declare const jest: typeof import("@jest/globals").jest;

const mockSignIn = jest.fn(async () => undefined);
const mockReturnToSignIn = jest.fn();
let mockAuth = {
  status: "signedOut",
  message: undefined as string | undefined,
  signIn: mockSignIn,
  returnToSignIn: mockReturnToSignIn
};

jest.mock("@/auth/auth-provider", () => ({ useAuth: () => mockAuth }));

import LoginScreen from "@/app/(auth)/login";

describe("LoginScreen", () => {
  it("shows accessible validation errors without submitting", async () => {
    mockAuth = { ...mockAuth, status: "signedOut", message: undefined };
    const screen = await render(<LoginScreen />);
    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "Sign in securely" }));
    });
    await waitFor(() => expect(screen.getByText("Enter your email address.")).toBeTruthy());
    expect(screen.getByText("Enter your password.")).toBeTruthy();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("shows a useful authentication error", async () => {
    mockAuth = { ...mockAuth, status: "signedOut", message: "The email or password is incorrect." };
    const screen = await render(<LoginScreen />);
    expect(screen.getByText("The email or password is incorrect.")).toBeTruthy();
  });

  it("disables duplicate submission while signing in", async () => {
    mockAuth = { ...mockAuth, status: "signingIn", message: undefined };
    const screen = await render(<LoginScreen />);
    const button = screen.getByRole("button", { name: "Signing in…" });
    fireEvent.press(button);
    expect(mockSignIn).not.toHaveBeenCalled();
  });
});
