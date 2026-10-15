import { Component, type ErrorInfo, type ReactNode } from 'react';
import i18n from '../i18n';
import { reportClientError } from '../lib/errorReporter';

/**
 * 화면을 그리다 오류가 나도 하얀 화면으로 멈추지 않게 하고, 오류를 서버에 자동으로 보낸다(2026-10-16).
 * 새로고침 또는 처음 화면으로 돌아갈 수 있다.
 */
export default class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportClientError(Object.assign(new Error(error.message), { stack: `${error.stack ?? ''}\n${info.componentStack ?? ''}` }));
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const t = (k: string) => i18n.t(k);
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center font-body-md text-on-background">
        <div className="max-w-md space-y-4">
          <div className="text-5xl" aria-hidden>
            🛠️
          </div>
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-deep-navy">{t('errorBoundary.title')}</h1>
          <p className="text-on-surface-variant">{t('errorBoundary.body')}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-full bg-primary px-5 py-2.5 font-label-md text-label-md text-on-primary"
            >
              {t('errorBoundary.reload')}
            </button>
            <button
              type="button"
              onClick={() => window.location.assign('/')}
              className="rounded-full border border-primary px-5 py-2.5 font-label-md text-label-md text-primary"
            >
              {t('errorBoundary.home')}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
