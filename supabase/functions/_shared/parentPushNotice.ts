const messages = {
  inquiry: ['학부모 문의가 도착했어요.', 'A parent sent an inquiry.'],
  answered: ['선생님이 문의에 답변했어요.', 'Your teacher answered your inquiry.'],
  started: ['숙제를 시작했어요.', 'Homework was started.'],
  published: ['새 숙제가 발행됐어요.', 'New homework was assigned.'],
  completed: ['숙제를 완료했어요.', 'Homework was completed.'],
  overdue: ['마감까지 숙제 완료 기록이 없어요.', 'No homework completion was recorded by the deadline.'],
  attendance: ['출석이 기록됐어요.', 'Attendance was recorded.'],
  checkout: ['하원이 기록됐어요.', 'Departure was recorded.'],
  attendance_changed: ['출석 기록이 수정됐어요.', 'Attendance was updated.'],
  feedback: ['선생님이 학생 피드백을 보냈어요.', 'Your teacher sent student feedback.'],
  daily_completed: ['오늘 분량의 단어 학습을 마쳤어요.', 'Today’s word practice was completed.'],
  homework_checked: ['선생님이 숙제 완료를 확인했어요.', 'Your teacher recorded homework as completed.'],
  homework_missing: ['선생님이 숙제 미제출을 기록했어요.', 'Your teacher recorded missing homework.'],
} as const;

export type ParentPushEvent = keyof typeof messages;
export function parentPushBody(event: ParentPushEvent, lang: 'ko' | 'en') {
  return messages[event]?.[lang === 'en' ? 1 : 0];
}
