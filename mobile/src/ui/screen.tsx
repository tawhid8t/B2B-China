import type { PropsWithChildren } from "react";
import { ScrollView, StyleSheet, View, type ViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, spacing } from "@/theme/tokens";

type Props = PropsWithChildren<ViewProps & { justify?: "center" | "start" }>;

export function Screen({ children, justify = "start", style, ...rest }: Props) {
  return (
    <SafeAreaView edges={["top", "left", "right", "bottom"]} style={styles.safe} {...rest}>
      <ScrollView contentContainerStyle={[styles.content, justify === "center" && styles.center, style]} keyboardShouldPersistTaps="handled">
        <View style={styles.stack}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { flexGrow: 1, padding: spacing.x5, paddingBottom: spacing.x10 },
  center: { justifyContent: "center" },
  stack: { gap: spacing.x4 }
});
