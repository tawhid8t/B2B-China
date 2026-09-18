import { randomUUID } from "node:crypto";

export const CAINIAO_SCREENSHOT_MAX_BYTES = 8 * 1024 * 1024;

export const CAINIAO_SCREENSHOT_MIME_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type CainiaoScreenshotMimeType = keyof typeof CAINIAO_SCREENSHOT_MIME_EXTENSIONS;

export function isCainiaoScreenshotMimeType(value: string): value is CainiaoScreenshotMimeType {
  return value in CAINIAO_SCREENSHOT_MIME_EXTENSIONS;
}

export function cainiaoScreenshotObjectPath(profileId: string, mimeType: CainiaoScreenshotMimeType) {
  return `${profileId}/${randomUUID()}.${CAINIAO_SCREENSHOT_MIME_EXTENSIONS[mimeType]}`;
}
