import React from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import * as Sentry from "@sentry/react-native";
import { colors } from "../../theme/colors";
import { fonts } from "../../theme/typography";
import { spacing } from "../../theme/spacing";

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
};

/**
 * Root-level error boundary. Wraps the entire Stack in app/_layout.tsx so that
 * any uncaught render error shows a recoverable HUD screen instead of a white
 * screen.
 *
 * Phase 7.1: every caught error is forwarded to Sentry along with the
 * React component stack so we get a useful breadcrumb trail in the
 * dashboard. The console.error stays for dev visibility.
 */
export class RootErrorBoundary extends React.Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("[RootErrorBoundary]", error, errorInfo.componentStack);
    this.setState({ errorInfo });
    // Phase 7.1: forward to Sentry. The component stack lands as a
    // breadcrumb so we can see which subtree blew up.
    Sentry.captureException(error, {
      extra: {
        componentStack: errorInfo.componentStack ?? "(no component stack)",
      },
      tags: { boundary: "root" },
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const message = this.state.error?.message ?? "Unknown error";
    const stack = this.state.error?.stack ?? "";

    return (
      <View style={styles.container}>
        <View style={styles.panel}>
          <Text style={styles.kicker}>SYSTEM FAULT</Text>
          <Text style={styles.title}>Something broke.</Text>
          <Text style={styles.subtitle}>
            Your data is safe. Reset the protocol to return to command.
          </Text>

          <ScrollView style={styles.errorBox} contentContainerStyle={styles.errorBoxContent}>
            <Text style={styles.errorLabel}>ERROR</Text>
            <Text style={styles.errorText}>{message}</Text>
            {__DEV__ && stack ? (
              <>
                <Text style={[styles.errorLabel, { marginTop: spacing.md }]}>STACK</Text>
                <Text style={styles.errorText}>{stack}</Text>
              </>
            ) : null}
          </ScrollView>

          <Pressable style={styles.button} onPress={this.handleReset}>
            <Text style={styles.buttonText}>RESET TO COMMAND</Text>
          </Pressable>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  panel: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.dangerDim,
    borderRadius: 16,
    padding: spacing.xl,
  },
  kicker: {
    ...fonts.kicker,
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  title: {
    ...fonts.title,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...fonts.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  errorBox: {
    maxHeight: 220,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 8,
    marginBottom: spacing.lg,
  },
  errorBoxContent: {
    padding: spacing.md,
  },
  errorLabel: {
    ...fonts.kicker,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  errorText: {
    ...fonts.mono,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  button: {
    backgroundColor: colors.surfaceBorderStrong,
    borderWidth: 1,
    borderColor: colors.cardBorderActive,
    borderRadius: 8,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  buttonText: {
    ...fonts.caption,
    color: colors.text,
  },
});
