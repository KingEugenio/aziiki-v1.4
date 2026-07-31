import React from "react";
import { Bug, House, ArrowClockwise } from "@phosphor-icons/react";
import StatusScreen, { type StatusAction } from "./StatusScreen";
import { reportClientError } from "../../lib/errorReporting";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Extra recovery actions beyond "Try again" / "Report this issue" - e.g.
   * "Go to Dashboard" (App.tsx's inner boundary, resets activeTab state) or
   * "Reload app" (main.tsx's outer boundary, a real window.location.reload()
   * for the rare case where App.tsx's own state is what crashed). Caller
   * controls the label since "Go to Dashboard" doesn't make sense everywhere. */
  extraActions?: StatusAction[];
}

interface ErrorBoundaryState {
  error: Error | null;
}

// AZIIKI ERROR SYSTEM — catches render-time crashes anywhere below it in the
// tree and shows a branded "something went wrong" screen instead of a blank
// white page (React unmounts the whole tree below a boundary on an uncaught
// render error by default - without this, that means the whole app). Wrapped
// around the app root in App.tsx. Does NOT catch errors in event handlers,
// async code, or SSR (React limitation, not a bug here) - see
// errorReporting.ts's installGlobalErrorReporting() for those.
export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary] caught a render crash:", error, info.componentStack);
    reportClientError({
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack ?? undefined,
      source: "error-boundary",
    });
  }

  private handleRetry = () => {
    this.setState({ error: null });
  };

  private handleReportIssue = () => {
    const subject = encodeURIComponent("Aziiki crash report");
    const body = encodeURIComponent(
      `I ran into a problem in Aziiki.\n\nWhat I was doing: \n\n(Technical details have already been sent automatically - no need to paste anything below.)\n\n${this.state.error?.message ?? ""}`
    );
    window.open(`mailto:support@aziiki.com?subject=${subject}&body=${body}`, "_blank");
  };

  render() {
    if (this.state.error) {
      return (
        <StatusScreen
          fullScreen
          tone="danger"
          icon={Bug}
          eyebrow="Something went wrong"
          title="We hit an unexpected problem"
          message="This has already been reported to the team automatically. Your data is safe - try again, or head back to your dashboard."
          actions={[
            { label: "Try again", onClick: this.handleRetry, variant: "primary" },
            ...(this.props.extraActions ?? []),
            { label: "Report this issue", onClick: this.handleReportIssue, variant: "secondary" },
          ]}
        />
      );
    }
    return this.props.children;
  }
}

// Re-exported so callers only need one import for the common "retry" icon
// used alongside StatusScreen in other status configs (see statusPresets.ts).
export { ArrowClockwise, House };
