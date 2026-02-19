import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || "Unexpected error" };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary] caught", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 16, color: "#fff", background: "#1a1a26", borderRadius: 8, margin: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Something went wrong</div>
          <div style={{ opacity: 0.85 }}>{this.state.message}</div>
          <button
            style={{ marginTop: 10, padding: "6px 10px", borderRadius: 6 }}
            onClick={() => window.location.reload()}
            type="button"
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
