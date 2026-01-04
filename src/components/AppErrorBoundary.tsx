import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  error?: Error;
};

export default class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Ensures we get actionable logs on devices (especially iOS Safari/PWA)
    console.error("[AppErrorBoundary] Uncaught error:", error);
    console.error("[AppErrorBoundary] Component stack:", errorInfo.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="min-h-screen bg-background text-foreground p-6 flex items-center justify-center">
        <Card className="max-w-lg w-full">
          <CardHeader>
            <CardTitle>Something went wrong</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              The app hit an unexpected error. Try reloading. If it keeps happening on iPhone/iPad,
              we can use the console error output to pinpoint the exact cause.
            </p>
            <div className="flex gap-2">
              <Button onClick={() => window.location.reload()}>Reload</Button>
              <Button
                variant="outline"
                onClick={() => this.setState({ hasError: false, error: undefined })}
              >
                Try again
              </Button>
            </div>
            {this.state.error?.message ? (
              <pre className="text-xs whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-3 overflow-auto max-h-48">
                {this.state.error.message}
              </pre>
            ) : null}
          </CardContent>
        </Card>
      </main>
    );
  }
}
