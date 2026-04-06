import { Stack } from "expo-router";
import { colors } from "../../src/theme";

/**
 * Phase 3.2: Auth stack layout.
 *
 * Groups the auth screens (login, email-login, signup, verify) under a
 * single headerless Stack with a dark background. Screens share the
 * slide-from-right animation of the rest of the app; `login` is the
 * default initial route since the root layout redirects unauthenticated
 * users to `/(auth)/login`.
 */
export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        animation: "slide_from_right",
      }}
    />
  );
}
