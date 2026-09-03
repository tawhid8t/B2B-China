import type { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "@/theme/tokens";

export function SurfaceCard({ children }: PropsWithChildren) {
  return <View style={styles.card}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface, borderColor: colors.borderDefault, borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth, gap: spacing.x2, padding: spacing.x4,
    shadowColor: colors.ink, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.05, shadowRadius: 16, elevation: 2
  }
});
