export const LESSON_CHANGED='classbank:lesson-changed';
/** Read-side invalidation only. Call after an explicit lesson write has succeeded. */
export function announceLessonChange(academyId:string,lessonId:string){window.dispatchEvent(new CustomEvent(LESSON_CHANGED,{detail:{academyId,lessonId}}));}
