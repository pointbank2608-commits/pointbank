import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

/**
 * 화면(페이지) 코드 분할용 React.lazy(2026-10-17). 배포 직후 옛 화면을 열어 둔 탭은 사라진 조각 파일을
 * 못 받아 "불러오기 실패"가 나는데, 그때는 한 번만 자동으로 새로고침해서 새 버전을 받게 한다.
 * (새로고침해도 또 실패하면 AppErrorBoundary 가 안내 화면을 보여 준다.)
 */
const RELOAD_KEY = 'classbank.chunkReloadAt';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyPage<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>): LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      try {
        const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
        if (Date.now() - last > 30_000) {
          sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
          window.location.reload();
          // 새로고침되는 동안 화면이 에러로 깜빡이지 않게 끝나지 않는 약속을 돌려준다
          return await new Promise<never>(() => undefined);
        }
      } catch {
        /* sessionStorage 를 못 쓰면 그냥 오류로 넘긴다 */
      }
      throw err;
    }
  });
}
