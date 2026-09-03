import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { z } from "zod";

const CHUNK_BYTES = 1_800;
const MAX_CHUNKS = 32;
const STORAGE_VERSION = 1;
const secureStoreOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED,
  keychainService: "bridgecart-mobile-auth-v1",
  requireAuthentication: false
};

const manifestSchema = z.object({
  version: z.literal(STORAGE_VERSION),
  slot: z.enum(["a", "b"]),
  chunkCount: z.number().int().min(1).max(MAX_CHUNKS),
  digest: z.string().regex(/^[a-f0-9]{64}$/)
});

type Manifest = z.infer<typeof manifestSchema>;

export class SecureSessionStorageError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "SecureSessionStorageError";
  }
}

function manifestKey(key: string) {
  return `${key}.v${STORAGE_VERSION}.meta`;
}

function chunkKey(key: string, slot: Manifest["slot"], index: number) {
  return `${key}.v${STORAGE_VERSION}.${slot}.${index}`;
}

async function digest(value: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value, { encoding: Crypto.CryptoEncoding.HEX });
}

/** SecureStore-backed Supabase storage. Values are ASCII-encoded before chunking. */
export class ChunkedSecureStorage {
  private failure: SecureSessionStorageError | null = null;

  consumeFailure() {
    const failure = this.failure;
    this.failure = null;
    return failure;
  }

  async getItem(key: string): Promise<string | null> {
    try {
      const manifest = await this.readManifest(key);
      if (!manifest) return null;
      const chunks = await Promise.all(Array.from({ length: manifest.chunkCount }, (_, index) =>
        SecureStore.getItemAsync(chunkKey(key, manifest.slot, index), secureStoreOptions)
      ));
      if (chunks.some((chunk) => chunk === null)) {
        throw new SecureSessionStorageError("The saved session is incomplete.");
      }
      const encoded = chunks.join("");
      let value: string;
      try {
        value = decodeURIComponent(encoded);
      } catch (error) {
        throw new SecureSessionStorageError("The saved session could not be decoded.", error);
      }
      if (await digest(value) !== manifest.digest) {
        throw new SecureSessionStorageError("The saved session failed its integrity check.");
      }
      return value;
    } catch (error) {
      const failure = error instanceof SecureSessionStorageError
        ? error
        : new SecureSessionStorageError("Secure session storage could not be read.", error);
      this.failure = failure;
      if (error instanceof SecureSessionStorageError) {
        try {
          await this.purgeAllSlots(key);
        } catch (purgeError) {
          const purgeFailure = new SecureSessionStorageError("The invalid secure session could not be cleared.", purgeError);
          this.failure = purgeFailure;
          throw purgeFailure;
        }
        return null;
      }
      throw failure;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    const encoded = encodeURIComponent(value);
    const chunks = Array.from({ length: Math.ceil(encoded.length / CHUNK_BYTES) }, (_, index) =>
      encoded.slice(index * CHUNK_BYTES, (index + 1) * CHUNK_BYTES)
    );
    if (chunks.length === 0 || chunks.length > MAX_CHUNKS) {
      throw new SecureSessionStorageError("The session is too large for secure storage.");
    }

    let previous: Manifest | null;
    try {
      previous = await this.readManifest(key);
    } catch {
      await this.purgeAllSlots(key);
      previous = null;
    }
    const slot: Manifest["slot"] = previous?.slot === "a" ? "b" : "a";

    try {
      await Promise.all(chunks.map((chunk, index) =>
        SecureStore.setItemAsync(chunkKey(key, slot, index), chunk, secureStoreOptions)
      ));
      const manifest: Manifest = { version: STORAGE_VERSION, slot, chunkCount: chunks.length, digest: await digest(value) };
      await SecureStore.setItemAsync(manifestKey(key), JSON.stringify(manifest), secureStoreOptions);
      if (previous) await this.removeSlot(key, previous.slot, previous.chunkCount);
      this.failure = null;
    } catch (error) {
      await this.removeSlot(key, slot, chunks.length).catch(() => undefined);
      const failure = new SecureSessionStorageError("The session could not be saved securely.", error);
      this.failure = failure;
      throw failure;
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      const manifest = await this.readManifest(key);
      await SecureStore.deleteItemAsync(manifestKey(key), secureStoreOptions);
      if (manifest) await this.removeSlot(key, manifest.slot, manifest.chunkCount);
      this.failure = null;
    } catch (error) {
      try {
        await this.purgeAllSlots(key);
      } catch (purgeError) {
        const failure = new SecureSessionStorageError("The secure session could not be removed.", purgeError);
        this.failure = failure;
        throw failure;
      }
      this.failure = error instanceof SecureSessionStorageError
        ? error
        : new SecureSessionStorageError("The secure session manifest was invalid.", error);
    }
  }

  private async readManifest(key: string): Promise<Manifest | null> {
    const raw = await SecureStore.getItemAsync(manifestKey(key), secureStoreOptions);
    if (!raw) return null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new SecureSessionStorageError("The secure session manifest is invalid.", error);
    }
    const manifest = manifestSchema.safeParse(parsed);
    if (!manifest.success) throw new SecureSessionStorageError("The secure session manifest is invalid.");
    return manifest.data;
  }

  private async removeSlot(key: string, slot: Manifest["slot"], count: number) {
    await Promise.all(Array.from({ length: count }, (_, index) =>
      SecureStore.deleteItemAsync(chunkKey(key, slot, index), secureStoreOptions)
    ));
  }

  private async purgeAllSlots(key: string) {
    await SecureStore.deleteItemAsync(manifestKey(key), secureStoreOptions);
    await Promise.all((["a", "b"] as const).flatMap((slot) =>
      Array.from({ length: MAX_CHUNKS }, (_, index) =>
        SecureStore.deleteItemAsync(chunkKey(key, slot, index), secureStoreOptions)
      )
    ));
  }
}

export const secureSessionStorage = new ChunkedSecureStorage();
