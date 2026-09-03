import type { ErrorInfo, PropsWithChildren } from "react";
import { Component } from "react";

import { logger } from "@/foundation/logger";
import { AppButton } from "@/ui/app-button";
import { AppText } from "@/ui/app-text";
import { Screen } from "@/ui/screen";

type State = { error: Error | null };

export class AppErrorBoundary extends Component<PropsWithChildren, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    logger.error("app_render_failure", { message: error.message, componentStack: info.componentStack });
  }

  render() {
    if (this.state.error) {
      return (
        <Screen justify="center">
          <AppText role="title">Something went wrong</AppText>
          <AppText tone="secondary">The app shell is still safe. Restart this screen to continue.</AppText>
          <AppButton label="Try again" onPress={() => this.setState({ error: null })} />
        </Screen>
      );
    }
    return this.props.children;
  }
}
