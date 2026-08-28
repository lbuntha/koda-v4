import React from "react";
import { RotateCcw, X } from "lucide-react";

import { themeSystem } from "../../../lib/themeSystem";

/**
 * Catches a throw inside an activity so it costs the round, not the app.
 *
 * React unmounts the entire tree when a render throws and nothing catches it —
 * a child gets a white screen, with no message and no way back, and the only
 * route out is closing the tab. A malformed lesson param, an undefined asset, a
 * bad edit saved from the Skill Manager: none of those should be able to end a
 * session.
 *
 * Deliberately scoped to one activity rather than the whole app. Wrapping the
 * root would keep the window alive but leave the child staring at a dead page;
 * wrapping here means the sidebar, the path and their progress are all still
 * there, and "go back" is a real place to go.
 *
 * A class, because `componentDidCatch` and `getDerivedStateFromError` have no
 * hook equivalent — this is the one thing React still requires one for.
 */
interface Props {
  children: React.ReactNode;
  /** Leave the round. The way out has to exist, or the message is a dead end. */
  onExit(): void;
  /** Names the activity in the console, so a report can be traced to a lesson. */
  activityRef?: string;
}

interface State {
  error: Error | null;
}

export class ActivityErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    /*
     * Logged, not swallowed.
     *
     * The child sees a kind sentence; whoever is fixing it needs the stack and
     * the activity that produced it. `console.error` rather than the learning
     * log on purpose — that log is a record of what a child did, and a crash is
     * not something they did.
     */
    console.error(
      `[skill] activity crashed${this.props.activityRef ? `: ${this.props.activityRef}` : ""}`,
      error,
      info.componentStack,
    );
  }

  /** Try the same activity again — a transient failure deserves one retry. */
  private retry = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-muted text-3xl">
            {/* Not an error triangle. Nothing here is the child's fault and
                nothing is broken about them; the tone is "oops", not "alert". */}
            🧩
          </div>
          <h2 className="text-xl font-extrabold text-ink">That didn't work</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            Something went wrong with this lesson. Your progress is safe.
          </p>

          <div className="mt-5 flex flex-col gap-2">
            <button onClick={this.retry} className={themeSystem.button("primary", "lg", "w-full")}>
              <RotateCcw />
              Try again
            </button>
            <button
              onClick={this.props.onExit}
              className={themeSystem.button("secondary", "lg", "w-full")}
            >
              <X />
              Back to lessons
            </button>
          </div>
        </div>
      </div>
    );
  }
}
