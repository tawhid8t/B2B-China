import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { useAuth } from "@/auth/auth-provider";
import { loginSchema, type LoginValues } from "@/auth/login-schema";
import { colors, radius, spacing, typography } from "@/theme/tokens";
import { AppButton } from "@/ui/app-button";
import { AppText } from "@/ui/app-text";
import { Screen } from "@/ui/screen";
import { SurfaceCard } from "@/ui/surface-card";

export default function LoginScreen() {
  const { status, message, signIn, returnToSignIn } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const { control, handleSubmit, formState: { errors } } = useForm<LoginValues>({
    defaultValues: { email: "", password: "" },
    resolver: zodResolver(loginSchema)
  });
  const isLoading = status === "signingIn";

  if (status === "forbidden") {
    return (
      <Screen testID="forbidden-client-screen" justify="center">
        <AppText role="eyebrow">BridgeCart Client</AppText>
        <AppText role="title">Client access required</AppText>
        <SurfaceCard>
          <AppText accessibilityRole="alert">{message}</AppText>
          <AppText tone="secondary">Contact BridgeCart support if you believe your account should have client access.</AppText>
        </SurfaceCard>
        <AppButton label="Use another account" onPress={returnToSignIn} />
      </Screen>
    );
  }

  return (
    <Screen testID="login-screen" justify="center">
      <AppText role="eyebrow">BridgeCart Client</AppText>
      <AppText role="display">Welcome back</AppText>
      <AppText tone="secondary">Sign in to continue managing your sourcing account.</AppText>
      <SurfaceCard>
        <Controller
          control={control}
          name="email"
          render={({ field: { onBlur, onChange, value } }) => (
            <View style={styles.field}>
              <AppText role="label">Email address</AppText>
              <TextInput
                accessibilityLabel="Email address"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                editable={!isLoading}
                inputMode="email"
                onBlur={onBlur}
                onChangeText={onChange}
                returnKeyType="next"
                style={[styles.input, errors.email && styles.inputError]}
                textContentType="emailAddress"
                value={value}
              />
              {errors.email ? <AppText accessibilityRole="alert" style={styles.errorText}>{errors.email.message}</AppText> : null}
            </View>
          )}
        />
        <Controller
          control={control}
          name="password"
          render={({ field: { onBlur, onChange, value } }) => (
            <View style={styles.field}>
              <AppText role="label">Password</AppText>
              <View style={[styles.passwordRow, errors.password && styles.inputError]}>
                <TextInput
                  accessibilityLabel="Password"
                  autoCapitalize="none"
                  autoComplete="current-password"
                  editable={!isLoading}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  onSubmitEditing={() => void handleSubmit((values) => signIn(values.email, values.password))()}
                  returnKeyType="done"
                  secureTextEntry={!showPassword}
                  style={styles.passwordInput}
                  textContentType="password"
                  value={value}
                />
                <Pressable
                  accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                  accessibilityRole="button"
                  disabled={isLoading}
                  hitSlop={8}
                  onPress={() => setShowPassword((current) => !current)}
                  style={styles.visibilityButton}
                >
                  <AppText role="label">{showPassword ? "Hide" : "Show"}</AppText>
                </Pressable>
              </View>
              {errors.password ? <AppText accessibilityRole="alert" style={styles.errorText}>{errors.password.message}</AppText> : null}
            </View>
          )}
        />
        {message ? <AppText accessibilityRole="alert" style={styles.errorText}>{message}</AppText> : null}
      </SurfaceCard>
      <AppButton
        disabled={isLoading}
        label={isLoading ? "Signing in…" : "Sign in securely"}
        onPress={() => void handleSubmit((values) => signIn(values.email, values.password))()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.x2 },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.borderDefault,
    borderRadius: radius.control,
    borderWidth: 1,
    color: colors.ink,
    fontFamily: typography.regular,
    fontSize: typography.bodySize,
    minHeight: 52,
    paddingHorizontal: spacing.x4
  },
  inputError: { borderColor: colors.danger },
  passwordRow: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.borderDefault,
    borderRadius: radius.control,
    borderWidth: 1,
    flexDirection: "row"
  },
  passwordInput: {
    color: colors.ink,
    flex: 1,
    fontFamily: typography.regular,
    fontSize: typography.bodySize,
    minHeight: 52,
    paddingLeft: spacing.x4
  },
  visibilityButton: { alignItems: "center", justifyContent: "center", minHeight: 48, minWidth: 64, paddingHorizontal: spacing.x3 },
  errorText: { color: colors.danger }
});
