import { apiFetch } from './api';
const base = (ws: string) => `/workspaces/${ws}/academy`;
const post = (body: unknown) => ({ method: 'POST', body: JSON.stringify(body) });
const patch = (body: unknown) => ({ method: 'PATCH', body: JSON.stringify(body) });

export interface Course { id: string; title: string; description: string | null; published: boolean; lessonCount: number; students: number; myProgress: number | null }
export interface LessonRow { id: string; title: string; position: number; video_url: string | null; checklist: string[]; done: boolean }
export interface Lesson { id: string; course_id: string; title: string; body: string | null; video_url: string | null; checklist: string[] }
export interface Submission { id: string; lesson_id: string; user_id: string; note: string | null; status: 'pending' | 'approved' | 'try_again'; feedback: string | null; created_at: string; photoUrl: string | null; lesson?: { title: string } | null }
export interface Student { userId: string; email: string | null; name: string; courses: Array<{ courseId: string; title: string; progress: number }> }

export const listCourses = (ws: string) => apiFetch<{ role: 'owner' | 'student'; courses: Course[] }>(`${base(ws)}/courses`);
export const createCourse = (ws: string, input: { title: string; description?: string }) => apiFetch<Course>(`${base(ws)}/courses`, post(input));
export const getCourse = (ws: string, id: string) => apiFetch<{ role: 'owner' | 'student'; course: Course & { description: string | null }; lessons: LessonRow[]; progress: number }>(`${base(ws)}/courses/${id}`);
export const updateCourse = (ws: string, id: string, input: Record<string, unknown>) => apiFetch(`${base(ws)}/courses/${id}`, patch(input));
export const deleteCourse = (ws: string, id: string) => apiFetch(`${base(ws)}/courses/${id}`, { method: 'DELETE' });
export const addLesson = (ws: string, courseId: string, input: { title: string }) => apiFetch<Lesson>(`${base(ws)}/courses/${courseId}/lessons`, post(input));
export const reorderLessons = (ws: string, courseId: string, lessonIds: string[]) => apiFetch(`${base(ws)}/courses/${courseId}/reorder`, post({ lessonIds }));
export const enrollStudent = (ws: string, courseId: string, userId: string, remove = false) => apiFetch(`${base(ws)}/courses/${courseId}/${remove ? 'unenroll' : 'enroll'}`, post({ userId }));
export const getLesson = (ws: string, id: string) => apiFetch<{ role: 'owner' | 'student'; lesson: Lesson; video: { kind: 'none' | 'file' | 'youtube' | 'vimeo' | 'link'; embedUrl: string | null }; progress: { checklist_done: number[]; done_at: string | null }; submissions: Submission[] }>(`${base(ws)}/lessons/${id}`);
export const updateLesson = (ws: string, id: string, input: Record<string, unknown>) => apiFetch(`${base(ws)}/lessons/${id}`, patch(input));
export const deleteLesson = (ws: string, id: string) => apiFetch(`${base(ws)}/lessons/${id}`, { method: 'DELETE' });
export const saveProgress = (ws: string, id: string, input: { checklistDone?: number[]; done?: boolean }) => apiFetch(`${base(ws)}/lessons/${id}/progress`, post(input));
export const submitPractice = (ws: string, id: string, input: { photoBase64?: string; note?: string }) => apiFetch(`${base(ws)}/lessons/${id}/submissions`, post(input));
export const listStudents = (ws: string) => apiFetch<{ students: Student[]; courses: Array<{ id: string; title: string }> }>(`${base(ws)}/students`);
export const createStudentInvite = (ws: string) => apiFetch<{ code: string; expiresAt: string }>(`${base(ws)}/students/invite`, post({}));
export const listSubmissions = (ws: string, status = 'pending') => apiFetch<Submission[]>(`${base(ws)}/submissions?status=${status}`);
export const reviewSubmission = (ws: string, id: string, input: { status: 'approved' | 'try_again'; feedback?: string }) => apiFetch(`${base(ws)}/submissions/${id}/review`, post(input));

export function inviteLink(code: string) {
  const origin = typeof window !== 'undefined' && window.location ? window.location.origin : 'https://app.angelos';
  return `${origin}/onboarding?invite=${encodeURIComponent(code)}`;
}
