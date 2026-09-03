import type { PropsWithChildren } from "react";
import { StyleSheet, Text, type TextProps, type TextStyle } from "react-native";

import { colors, typography } from "@/theme/tokens";

type Role = "display" | "title" | "eyebrow" | "label" | "button" | "body";
type Tone = "primary" | "secondary" | "inverse";
type Props = PropsWithChildren<Omit<TextProps, "role"> & { role?: Role; tone?: Tone; align?: "left" | "center" }>;

export function AppText({ children, role = "body", tone = "primary", align = "left", style, ...rest }: Props) {
  return <Text style={[styles.base, roleStyles[role], toneStyles[tone], { textAlign: align }, style]} {...rest}>{children}</Text>;
}

const styles = StyleSheet.create({
  base: { color: colors.ink, fontFamily: typography.regular, fontSize: typography.bodySize, lineHeight: 24 }
});

const roleStyles: Record<Role, TextStyle> = {
  display: { fontFamily: typography.display, fontSize: typography.displaySize, lineHeight: 40, fontWeight: "700" },
  title: { fontFamily: typography.display, fontSize: typography.titleSize, lineHeight: 32, fontWeight: "700" },
  eyebrow: { color: colors.aqua, fontFamily: typography.rounded, fontSize: typography.labelSize, fontWeight: "700", lineHeight: 20, textTransform: "uppercase", letterSpacing: 0.6 },
  label: { fontSize: typography.labelSize, lineHeight: 20, fontWeight: "600" },
  button: { fontSize: typography.bodySize, fontWeight: "700", lineHeight: 24 },
  body: {}
};

const toneStyles: Record<Tone, TextStyle> = {
  primary: { color: colors.ink },
  secondary: { color: colors.textSecondary },
  inverse: { color: colors.onInverse }
};
