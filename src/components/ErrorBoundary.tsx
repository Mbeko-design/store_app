import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "./Button";

interface State {
  error: Error | null;
}

/** Catches render/data errors → visible error state with retry (per-page). */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("CASHY page error:", error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <div role="alert" className="rounded-lg border border-neg-line bg-neg-bg p-6 text-center">
          <h2 className="text-lg font-extrabold text-neg">حدث خطأ في هذه الصفحة</h2>
          <p className="mx-auto mt-2 max-w-md break-words text-sm text-ink-2">{this.state.error.message}</p>
          <div className="mt-4 flex justify-center gap-3">
            <Button type="button" variant="primary" onClick={() => this.setState({ error: null })}>
              إعادة المحاولة
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
