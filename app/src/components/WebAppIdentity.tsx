import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { webAppForPath, webApps } from '../lib/webAppIdentity';

export default function WebAppIdentity() {
  const { pathname } = useLocation();
  const app = webApps[webAppForPath(pathname)];
  useLayoutEffect(() => {
    const attributes = [
      ['link[rel="manifest"]', 'href', app.manifest],
      ['link[rel="apple-touch-icon"]', 'href', app.touchIcon],
      ['meta[name="apple-mobile-web-app-title"]', 'content', app.homeName],
      ['meta[name="theme-color"]', 'content', app.theme],
    ] as const;
    for (const [selector, attribute, value] of attributes) {
      const node = document.querySelector(selector);
      if (node && node.getAttribute(attribute) !== value) node.setAttribute(attribute, value);
    }
    document.title = app.title;
  }, [app]);
  return null;
}
