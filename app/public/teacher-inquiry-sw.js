self.addEventListener('push', event => {
  let notice;
  try { notice = event.data?.json(); } catch { return; }
  if (![notice?.classId, notice?.thread].every(id => typeof id === 'string' && /^[a-f0-9-]{36}$/.test(id))) return;
  event.waitUntil(self.registration.showNotification(notice.title, {
    body: notice.body, tag: notice.tag, icon: '/icon-192.png',
    data: { classId: notice.classId, inquiry: notice.thread },
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = new URL('/attendance', self.location.origin);
  url.search = new URLSearchParams(event.notification.data).toString();
  event.waitUntil(self.clients.openWindow(url.href));
});
