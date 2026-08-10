import { Component, type ErrorInfo, type ReactNode } from "react";

import { reportRendererDiagnostic } from "../diagnostics/renderer-diagnostics.js";

type Props = Readonly<{
  children: ReactNode;
  boundaryKey: string;
  onNavigateDefault: () => void;
}>;

type State = Readonly<{ error: Error | null }>;

export class RendererErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    reportRendererDiagnostic({
      kind: "react_error_boundary",
      name: error.name,
      message: error.message || "Renderer component failed",
      ...(error.stack ? { stack: error.stack } : {}),
      ...(info.componentStack ? { componentStack: info.componentStack } : {}),
    });
  }

  override componentDidUpdate(previousProps: Props): void {
    if (previousProps.boundaryKey !== this.props.boundaryKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  override render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <section className="renderer-error-boundary" data-testid="renderer-error-boundary" role="alert">
        <p className="eyebrow">DESKTOP-EDITOR-001</p>
        <h2>해당 화면을 불러오는 중 오류가 발생했습니다.</h2>
        <p>다른 지면으로 이동하거나 다시 시도할 수 있습니다. 오류는 이 PC의 로컬 진단 로그에만 기록됩니다.</p>
        <details data-testid="renderer-error-details">
          <summary>오류 세부정보</summary>
          <pre>{this.state.error.name}: {this.state.error.message}</pre>
        </details>
        <div className="button-row">
          <button type="button" className="secondary" onClick={() => this.setState({ error: null })} data-testid="renderer-error-retry">다시 시도</button>
          <button type="button" className="primary" onClick={this.props.onNavigateDefault} data-testid="renderer-error-default">기본 화면으로</button>
        </div>
      </section>
    );
  }
}
