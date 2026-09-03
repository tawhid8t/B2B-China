import { Platform } from "react-native";

export const colors = {
  canvas: "#EEF3F3", surface: "#FFFFFF", surfaceMuted: "#F7FAFA", ink: "#07171B", inkStrong: "#0B2429",
  textSecondary: "#52636A", borderDefault: "#D9E1E2", actionPrimary: "#0B2429", actionPrimaryPressed: "#10333A",
  onInverse: "#FFFFFF", success: "#168F73", warning: "#E9A23B", danger: "#C84D56", mint: "#55D6BE",
  aqua: "#45C4DD", violet: "#7C6CFF", coral: "#F27868"
} as const;

export const spacing = { x1: 4, x2: 8, x3: 12, x4: 16, x5: 20, x6: 24, x8: 32, x10: 40, x12: 48 } as const;
export const radius = { control: 12, card: 20, sheet: 28, full: 999 } as const;
export const typography = {
  regular: Platform.select({ ios: "SF Pro Text", android: "sans-serif", default: "System" }),
  display: Platform.select({ ios: "SF Pro Display", android: "sans-serif-medium", default: "System" }),
  rounded: Platform.select({ ios: "SF Pro Rounded", android: "sans-serif-medium", default: "System" }),
  displaySize: 32, titleSize: 24, bodySize: 16, labelSize: 14, captionSize: 12
} as const;
