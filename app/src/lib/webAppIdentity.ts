export const webApps = {
  teacher: {
    manifest: '/manifest.webmanifest',
    title: '수업뚝딱 · 재미있는 영어 수업 도구',
    homeName: '수업뚝딱',
    theme: '#2765a8',
    touchIcon: '/brand/install-apple-180.png',
  },
  student: {
    manifest: '/student.webmanifest',
    title: '수업뚝딱 학생',
    homeName: '학생 수업뚝딱',
    theme: '#16213e',
    touchIcon: '/apple-touch-icon-student.png',
  },
  parent: {
    manifest: '/parent.webmanifest',
    title: '수업뚝딱 학부모',
    homeName: '수업뚝딱 학부모',
    theme: '#102B50',
    touchIcon: '/brand/install-apple-180.png',
  },
};

export function webAppForPath(pathname: string): keyof typeof webApps {
  if (pathname === '/s' || pathname.startsWith('/s/')) return 'student';
  if (pathname === '/p' || pathname === '/p/') return 'parent';
  return 'teacher';
}
