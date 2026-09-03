import { ActivityIndicator, StyleSheet, View } from "react-native";

import { colors, spacing } from "@/theme/tokens";
import { AppText } from "@/ui/app-text";

/** Shared non-data loading state. Feature skeletons are deferred until their real contracts exist. */
export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} style={styles.container}>
      <ActivityIndicator color={colors.actionPrimary} />
      <AppText tone="secondary">{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", gap: spacing.x3, justifyContent: "center", minHeight: 96 }
});
