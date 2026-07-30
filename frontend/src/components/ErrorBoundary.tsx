import React from "react";
import { RefreshCw } from "lucide-react";
import { reportClientError } from "../api/telemetry";

interface Props {
  children: React.ReactNode;
  /** Which screen this guards — travels with the report so a crash can be located. */
  surface: string;
  /**
   * Fallback wording. `learner` avoids the word "error" and any technical detail: a six-year
   * old cannot act on a stack trace and should not be made to feel they broke something.
   */
  tone?: "learner" | "adult";
}

interface State {
  failed: boolean;
  reference: string | null;
}

/**
 * Catches a render failure so one bad component cannot white-screen the whole app.
 *
 * Without a boundary, React unmounts the entire tree on any error thrown during render — a
 * skill with no questions, a release missing an asset, a mastery row from an older schema.
 * Much of this app renders learner data of varying shape, so that is a realistic outcome
 * rather than a theoretical one, and a blank page is unrecoverable for a child.
 *
 * The report goes to the server because the boundary only helps the person looking at the
 * screen; without it the failure never reaches anyone who can fix it.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { failed: false, reference: null };

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    void reportClientError({
      message: error.message,
      stack: error.stack ?? "",
      component_stack: info.componentStack ?? "",
      surface: this.props.surface,
      path: window.location.pathname,
    }).then(reference => this.setState({ reference }));
  }

  private reload = () => window.location.reload();

  render() {
    if (!this.state.failed) return this.props.children;

    const learner = this.props.tone !== "adult";
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center gap-4 bg-[#F7F4FF] p-6 text-center">
        <span className="text-5xl" role="img" aria-label="">
          {learner ? "🐣" : "⚠️"}
        </span>
        <h1 className="text-xl font-black text-[#21183D]">
          {learner ? "Let’s try that again" : "Something went wrong"}
        </h1>
        <p className="max-w-sm text-sm font-semibold text-[#6B6280]">
          {learner
            ? "Something got stuck — it isn’t your fault. Tap the button to start over."
            : "This screen failed to load. The problem has been reported."}
        </p>
        <button
          type="button"
          onClick={this.reload}
          className="inline-flex items-center gap-2 rounded-full bg-[#6346F1] px-6 py-2.5 text-sm font-extrabold text-white transition-transform hover:scale-105 active:scale-95"
        >
          <RefreshCw size={16} /> {learner ? "Start over" : "Reload"}
        </button>
        {/* Shown so an adult can quote it; it ties to exactly one server log line. */}
        {this.state.reference && (
          <p className="font-mono text-[11px] text-[#9A94B8]">
            Reference {this.state.reference}
          </p>
        )}
      </div>
    );
  }
}
