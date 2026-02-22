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
        <div className="error-boundary-fallback" role="alert" aria-live="assertive">
          <div className="error-boundary-fallback__title">Something went wrong</div>
          <div className="error-boundary-fallback__message">{this.state.message}</div>
          <div className="error-boundary-fallback__actions">
            <button
              className="error-boundary-fallback__btn"
              onClick={() => this.setState({ hasError: false, message: '' })}
              type="button"
              aria-label="Try again"
            >
              Try Again
            </button>
            <button
              className="error-boundary-fallback__btn error-boundary-fallback__btn--primary"
              onClick={() => window.location.reload()}
              type="button"
              aria-label="Reload page"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
