/* eslint-disable import/first, @typescript-eslint/no-require-imports -- native module factories must be hoisted before imports */
import { beforeEach, describe, expect, it } from "@jest/globals";

declare const jest: typeof import("@jest/globals").jest;

const mockValues = new Map<string, string>();

jest.mock("expo-secure-store", () => ({
  __esModule: true,
  WHEN_UNLOCKED: 0,
  getItemAsync: require("@jest/globals").jest.fn(),
  setItemAsync: require("@jest/globals").jest.fn(),
  deleteItemAsync: require("@jest/globals").jest.fn()
}));

jest.mock("expo-crypto", () => ({
  __esModule: true,
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  CryptoEncoding: { HEX: "hex" },
  digestStringAsync: require("@jest/globals").jest.fn(async (_algorithm: string, value: string) => {
    let hash = 0;
    for (const character of value) hash = (hash * 31 + character.codePointAt(0)!) >>> 0;
    return hash.toString(16).padStart(64, "0");
  })
}));

import { ChunkedSecureStorage, SecureSessionStorageError } from "@/foundation/secure-storage";
import * as SecureStore from "expo-secure-store";

const mockGetItemAsync = jest.mocked(SecureStore.getItemAsync);
const mockSetItemAsync = jest.mocked(SecureStore.setItemAsync);
const mockDeleteItemAsync = jest.mocked(SecureStore.deleteItemAsync);

describe("ChunkedSecureStorage", () => {
  beforeEach(() => {
    mockValues.clear();
    mockGetItemAsync.mockClear();
    mockSetItemAsync.mockClear();
    mockDeleteItemAsync.mockClear();
    mockGetItemAsync.mockImplementation(async (key) => mockValues.get(key) ?? null);
    mockSetItemAsync.mockImplementation(async (key, value) => { mockValues.set(key, value); });
    mockDeleteItemAsync.mockImplementation(async (key) => { mockValues.delete(key); });
  });

  it("round-trips a single secure chunk", async () => {
    const storage = new ChunkedSecureStorage();
    await storage.setItem("auth", "session-value");
    await expect(storage.getItem("auth")).resolves.toBe("session-value");
  });

  it("round-trips multibyte data across chunks", async () => {
    const storage = new ChunkedSecureStorage();
    const value = "会话-বাংলা-".repeat(500);
    await storage.setItem("auth", value);
    await expect(storage.getItem("auth")).resolves.toBe(value);
    expect([...mockValues.keys()].filter((key) => key.includes(".a.")).length).toBeGreaterThan(1);
  });

  it("commits into the inactive slot and removes replaced chunks", async () => {
    const storage = new ChunkedSecureStorage();
    await storage.setItem("auth", "first");
    await storage.setItem("auth", "second");
    await expect(storage.getItem("auth")).resolves.toBe("second");
    expect([...mockValues.keys()].some((key) => key.includes(".a.0"))).toBe(false);
    expect([...mockValues.keys()].some((key) => key.includes(".b.0"))).toBe(true);
  });

  it("invalidates and clears an incomplete session", async () => {
    const storage = new ChunkedSecureStorage();
    await storage.setItem("auth", "saved-session");
    mockValues.delete("auth.v1.a.0");
    await expect(storage.getItem("auth")).resolves.toBeNull();
    expect(storage.consumeFailure()).toBeInstanceOf(SecureSessionStorageError);
    expect(mockValues.has("auth.v1.meta")).toBe(false);
  });

  it("removes the manifest and its chunks", async () => {
    const storage = new ChunkedSecureStorage();
    await storage.setItem("auth", "saved-session");
    await storage.removeItem("auth");
    await expect(storage.getItem("auth")).resolves.toBeNull();
  });

  it("surfaces native secure storage read failures", async () => {
    const storage = new ChunkedSecureStorage();
    mockGetItemAsync.mockRejectedValueOnce(new Error("keystore unavailable"));
    await expect(storage.getItem("auth")).rejects.toBeInstanceOf(SecureSessionStorageError);
  });
});
