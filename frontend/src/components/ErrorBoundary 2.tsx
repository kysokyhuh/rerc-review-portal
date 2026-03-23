import React, { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", minHeight: "50vh", padding: "2rem",
          fontFamily: "var(--font-family, system-ui, sans-serif)",
        }}>
          <div style={{
            background: "var(--surface-error, #fef2f2)",
            border: "1px solid var(--border-error, #fecaca)",
            borderRadius: "var(--radius-lg, 12px)",
            padding: "2rem", maxWidth: "480px", textAlign: "center",
          }}>
            <h2 style={{ margin: "0 0 0.5rem", color: "var(--text-error, #dc2626)" }}>
              Something went wrong
            </h2>
            <p style={{ margin: "0 0 1rem", color: "var(--text-secondary, #6b7280)", fontSize: "0.875rem" }}>
              {this.state.error?.message || "An unexpected error occurred."}
            </p>
            <button
              onClick={this.handleRetry}
              style={{
                padding: "0.5rem 1.5rem",
                background: "var(--color-primary, #2563eb)",
                color: "#fff", border: "none",
                borderRadius: "var(--radius-md, 8px)",
                cursor: "pointer", fontSize: "0.875rem", fontWeight: 500,
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
