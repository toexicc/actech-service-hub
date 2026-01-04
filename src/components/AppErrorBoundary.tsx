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

    let lastGlobalError: { kind?: string; message?: string; at?: string; href?: string } | null = null;
    try {
      const raw = localStorage.getItem("actech:last_global_error");
      lastGlobalError = raw ? JSON.parse(raw) : null;
    } catch {
      // ignore
    }

    const details = this.state.error?.message || lastGlobalError?.message;

    return (
      <main className="min-h-screen bg-background text-foreground p-6 flex items-center justify-center">
        <Card className="max-w-lg w-full">
          <CardHeader>
            <CardTitle>Something went wrong</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              The app hit an unexpected error. Try reloading. If it keeps happening on iPhone/iPad,
              the error details below will help pinpoint the exact cause.
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
            {details ? (
              <pre className="text-xs whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-3 overflow-auto max-h-56">
                {details}
                {lastGlobalError?.at ? `\n\nTime: ${lastGlobalError.at}` : ""}
                {lastGlobalError?.href ? `\nURL: ${lastGlobalError.href}` : ""}
                {lastGlobalError?.kind ? `\nType: ${lastGlobalError.kind}` : ""}
              </pre>
            ) : null}
          </CardContent>
        </Card>
      </main>
    );
  }
}
