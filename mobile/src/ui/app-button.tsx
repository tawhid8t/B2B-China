import { Pressable, StyleSheet } from "react-native";

import { colors, radius, spacing } from "@/theme/tokens";
import { AppText } from "@/ui/app-text";

type Props = { label: string; onPress: () => void; variant?: "primary" | "secondary"; disabled?: boolean };

export function AppButton({ label, onPress, variant = "primary", disabled = false }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.base, variant === "primary" ? styles.primary : styles.secondary, (pressed || disabled) && styles.pressed]}
    >
      <AppText align="center" tone={variant === "primary" ? "inverse" : "primary"} role="button">{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 48, borderRadius: radius.control, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.x5 },
  primary: { backgroundColor: colors.actionPrimary },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderDefault },
  pressed: { opacity: 0.72 }
});
