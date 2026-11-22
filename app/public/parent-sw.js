self.addEventListener('push', (event) => {
  let notice;
  try {
    notice = event.data?.json();
  } catch {
    return;
  }
  if (typeof notice?.title !== 'string' || typeof notice.body !== 'string') return;
  event.waitUntil(self.registration.showNotification(notice.title, {
    body: notice.body,
    icon: '/icon-192.png',
    tag: notice.tag,
    data: { child: notice.child, thread: notice.thread },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const path = new URL('/p?view=notices', self.location.origin);
    const thread = event.notification.data?.thread;
    if (typeof thread === 'string' && /^[a-f0-9-]{36}$/.test(thread)) path.searchParams.set('inquiry', thread);
    const child = event.notification.data?.child;
    if (typeof child === 'string' && /^[a-f0-9-]{36}$/.test(child)) path.hash = 'child=' + child;
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const parent = windows.find((client) => new URL(client.url).pathname === '/p');
    if (parent) {
      const target = await parent.navigate(path.href);
      if (target) return target.focus();
    }
    return self.clients.openWindow(path.href);
  })());
});
