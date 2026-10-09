import { BadRequestException, ConflictException, ForbiddenException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { AuthUser } from '../auth/auth-user';
import { createServiceSupabaseClient, createUserSupabaseClient } from '../config/supabase';
import { isMissingRelation } from '../messaging/saved-replies.service';
import { decodePracticePhoto, progressPercent, sanitizeChecklist, validReorder, videoInfo } from './academy-logic';
import type { CourseDto, LessonDto, ProgressDto, ReviewDto, SubmissionDto } from './dto/academy.dto';

const MIGRATION = '0021_v1_roles_academy.sql';
const BUCKET = 'academy-submissions';

@Injectable()
export class AcademyService {
  private db(user: AuthUser) { return createUserSupabaseClient(user.accessToken); }
  private fail(error: any): never {
    if (isMissingRelation(error) || /column .* does not exist|invite_type/.test(String(error?.message ?? ''))) throw new ConflictException(`Academy needs the database update ${MIGRATION} (waiting for Angel's yes).`);
    throw new InternalServerErrorException(error?.message ?? 'Academy error');
  }

  async role(user: AuthUser, workspaceId: string): Promise<'owner' | 'student'> {
    const { data } = await this.db(user).from('workspace_memberships').select('role').eq('workspace_id', workspaceId).eq('user_id', user.id).maybeSingle();
    if (!data) throw new NotFoundException('Workspace not found');
    return data.role === 'student' ? 'student' : 'owner';
  }
  private async owner(user: AuthUser, workspaceId: string) { if ((await this.role(user, workspaceId)) !== 'owner') throw new ForbiddenException('Only the studio owner can do this.'); }

  // ---------- owner ----------
  async listCourses(user: AuthUser, workspaceId: string) {
    const role = await this.role(user, workspaceId);
    const db = this.db(user);
    const courses = await db.from('lms_courses').select('id,title,description,published,position,created_at').eq('workspace_id', workspaceId).order('position').order('created_at');
    if (courses.error) this.fail(courses.error);
    const ids = (courses.data ?? []).map((c: any) => c.id);
    const [lessons, progress, enrollments] = await Promise.all([
      ids.length ? db.from('lms_lessons').select('id,course_id').in('course_id', ids) : Promise.resolve({ data: [] as any[] }),
      db.from('lms_progress').select('lesson_id,user_id,done_at').eq('workspace_id', workspaceId).not('done_at', 'is', null),
      ids.length ? db.from('lms_enrollments').select('course_id,user_id').in('course_id', ids) : Promise.resolve({ data: [] as any[] })
    ]);
    return {
      role,
      courses: (courses.data ?? []).map((c: any) => {
        const lessonIds = (lessons.data ?? []).filter((l: any) => l.course_id === c.id).map((l: any) => l.id);
        const mine = (progress.data ?? []).filter((p: any) => p.user_id === user.id).map((p: any) => p.lesson_id);
        return { ...c, lessonCount: lessonIds.length, students: (enrollments.data ?? []).filter((e: any) => e.course_id === c.id).length, myProgress: role === 'student' ? progressPercent(lessonIds, mine) : null };
      })
    };
  }

  async createCourse(user: AuthUser, workspaceId: string, dto: CourseDto) {
    await this.owner(user, workspaceId);
    if (!dto.title?.trim()) throw new BadRequestException('Give the course a title.');
    const { data, error } = await this.db(user).from('lms_courses').insert({ workspace_id: workspaceId, title: dto.title.trim(), description: dto.description?.trim() || null, published: Boolean(dto.published), created_by: user.id }).select('*').single();
    if (error) this.fail(error);
    return data;
  }

  async updateCourse(user: AuthUser, workspaceId: string, courseId: string, dto: CourseDto) {
    await this.owner(user, workspaceId);
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (dto.title !== undefined) patch.title = dto.title.trim();
    if (dto.description !== undefined) patch.description = dto.description?.trim() || null;
    if (dto.published !== undefined) patch.published = dto.published;
    const { data, error } = await this.db(user).from('lms_courses').update(patch).eq('workspace_id', workspaceId).eq('id', courseId).select('*').maybeSingle();
    if (error) this.fail(error);
    if (!data) throw new NotFoundException('Course not found');
    return data;
  }

  async deleteCourse(user: AuthUser, workspaceId: string, courseId: string) {
    await this.owner(user, workspaceId);
    const { error } = await this.db(user).from('lms_courses').delete().eq('workspace_id', workspaceId).eq('id', courseId);
    if (error) this.fail(error);
    return { deleted: true };
  }

  async getCourse(user: AuthUser, workspaceId: string, courseId: string) {
    const role = await this.role(user, workspaceId);
    const db = this.db(user);
    const [course, lessons, progress] = await Promise.all([
      db.from('lms_courses').select('*').eq('workspace_id', workspaceId).eq('id', courseId).maybeSingle(),
      db.from('lms_lessons').select('id,title,position,video_url,checklist').eq('workspace_id', workspaceId).eq('course_id', courseId).order('position'),
      db.from('lms_progress').select('lesson_id,done_at').eq('workspace_id', workspaceId).eq('user_id', user.id)
    ]);
    if (course.error) this.fail(course.error);
    if (!course.data) throw new NotFoundException('Course not found');
    const done = new Set((progress.data ?? []).filter((p: any) => p.done_at).map((p: any) => p.lesson_id));
    const list = (lessons.data ?? []).map((l: any) => ({ ...l, done: done.has(l.id) }));
    return { role, course: course.data, lessons: list, progress: progressPercent(list.map((l) => l.id), done) };
  }

  async addLesson(user: AuthUser, workspaceId: string, courseId: string, dto: LessonDto) {
    await this.owner(user, workspaceId);
    if (!dto.title?.trim()) throw new BadRequestException('Give the lesson a title.');
    const db = this.db(user);
    const { data: last } = await db.from('lms_lessons').select('position').eq('course_id', courseId).order('position', { ascending: false }).limit(1);
    const { data, error } = await db.from('lms_lessons').insert({ workspace_id: workspaceId, course_id: courseId, title: dto.title.trim(), body: dto.body ?? null, video_url: dto.videoUrl || null, checklist: sanitizeChecklist(dto.checklist), position: ((last ?? [])[0]?.position ?? -1) + 1 }).select('*').single();
    if (error) this.fail(error);
    return data;
  }

  async updateLesson(user: AuthUser, workspaceId: string, lessonId: string, dto: LessonDto) {
    await this.owner(user, workspaceId);
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (dto.title !== undefined) patch.title = dto.title.trim();
    if (dto.body !== undefined) patch.body = dto.body;
    if (dto.videoUrl !== undefined) patch.video_url = dto.videoUrl || null;
    if (dto.checklist !== undefined) patch.checklist = sanitizeChecklist(dto.checklist);
    const { data, error } = await this.db(user).from('lms_lessons').update(patch).eq('workspace_id', workspaceId).eq('id', lessonId).select('*').maybeSingle();
    if (error) this.fail(error);
    if (!data) throw new NotFoundException('Lesson not found');
    return data;
  }

  async deleteLesson(user: AuthUser, workspaceId: string, lessonId: string) {
    await this.owner(user, workspaceId);
    const { error } = await this.db(user).from('lms_lessons').delete().eq('workspace_id', workspaceId).eq('id', lessonId);
    if (error) this.fail(error);
    return { deleted: true };
  }

  async reorder(user: AuthUser, workspaceId: string, courseId: string, lessonIds: string[]) {
    await this.owner(user, workspaceId);
    const db = this.db(user);
    const { data, error } = await db.from('lms_lessons').select('id').eq('workspace_id', workspaceId).eq('course_id', courseId);
    if (error) this.fail(error);
    if (!validReorder((data ?? []).map((l: any) => l.id), lessonIds)) throw new BadRequestException('The lesson list changed. Reload and try again.');
    for (const [position, id] of lessonIds.entries()) {
      const res = await db.from('lms_lessons').update({ position }).eq('workspace_id', workspaceId).eq('id', id);
      if (res.error) this.fail(res.error);
    }
    return { reordered: true };
  }

  async students(user: AuthUser, workspaceId: string) {
    await this.owner(user, workspaceId);
    const service = createServiceSupabaseClient();
    const { data: members, error } = await service.from('workspace_memberships').select('user_id,role,created_at').eq('workspace_id', workspaceId).eq('role', 'student');
    if (error) this.fail(error);
    const db = this.db(user);
    const [courses, lessons, enrollments, progress] = await Promise.all([
      db.from('lms_courses').select('id,title').eq('workspace_id', workspaceId),
      db.from('lms_lessons').select('id,course_id').eq('workspace_id', workspaceId),
      db.from('lms_enrollments').select('course_id,user_id').eq('workspace_id', workspaceId),
      db.from('lms_progress').select('lesson_id,user_id,done_at').eq('workspace_id', workspaceId).not('done_at', 'is', null)
    ]);
    if (courses.error) this.fail(courses.error);
    const out = [];
    for (const m of members ?? []) {
      const auth = await service.auth.admin.getUserById(m.user_id).catch(() => null);
      const email = auth?.data?.user?.email ?? null;
      const done = (progress.data ?? []).filter((p: any) => p.user_id === m.user_id).map((p: any) => p.lesson_id);
      out.push({
        userId: m.user_id, email, name: (auth?.data?.user?.user_metadata as any)?.display_name ?? email?.split('@')[0] ?? 'Student', joinedAt: m.created_at,
        courses: (enrollments.data ?? []).filter((e: any) => e.user_id === m.user_id).map((e: any) => {
          const c = (courses.data ?? []).find((x: any) => x.id === e.course_id);
          return { courseId: e.course_id, title: c?.title ?? 'Course', progress: progressPercent((lessons.data ?? []).filter((l: any) => l.course_id === e.course_id).map((l: any) => l.id), done) };
        })
      });
    }
    return { students: out, courses: courses.data ?? [] };
  }

  async enroll(user: AuthUser, workspaceId: string, courseId: string, studentId: string, remove = false) {
    await this.owner(user, workspaceId);
    const db = this.db(user);
    if (remove) {
      const { error } = await db.from('lms_enrollments').delete().eq('workspace_id', workspaceId).eq('course_id', courseId).eq('user_id', studentId);
      if (error) this.fail(error);
      return { enrolled: false };
    }
    const service = createServiceSupabaseClient();
    const { data: member } = await service.from('workspace_memberships').select('role').eq('workspace_id', workspaceId).eq('user_id', studentId).maybeSingle();
    if (member?.role !== 'student') throw new BadRequestException('This person is not a student in your studio yet. Send them a student invite first.');
    const { error } = await db.from('lms_enrollments').upsert({ workspace_id: workspaceId, course_id: courseId, user_id: studentId }, { onConflict: 'course_id,user_id' });
    if (error) this.fail(error);
    return { enrolled: true };
  }

  /** Owner invites a student into THIS studio. Returns the raw code once; only its hash is stored. */
  async studentInvite(user: AuthUser, workspaceId: string, label?: string) {
    await this.owner(user, workspaceId);
    const raw = randomBytes(24).toString('base64url');
    const service = createServiceSupabaseClient();
    const { data, error } = await service.from('beta_invites').insert({ token_hash: createHash('sha256').update(raw).digest('hex'), cohort: 'student', invite_type: 'student', workspace_id: workspaceId, label: label ?? 'Student invite', created_by: user.id, expires_at: new Date(Date.now() + 30 * 86400000).toISOString() }).select('id,expires_at').single();
    if (error) this.fail(error);
    return { id: data.id, code: raw, expiresAt: data.expires_at };
  }

  async submissions(user: AuthUser, workspaceId: string, status = 'pending') {
    await this.owner(user, workspaceId);
    const { data, error } = await this.db(user).from('lms_submissions').select('id,lesson_id,user_id,photo_path,note,status,feedback,created_at,lesson:lms_lessons(title)').eq('workspace_id', workspaceId).eq('status', status === 'all' ? 'pending' : status).order('created_at', { ascending: false }).limit(50);
    if (error) this.fail(error);
    return Promise.all((data ?? []).map((s: any) => this.withPhoto(s)));
  }

  async review(user: AuthUser, workspaceId: string, submissionId: string, dto: ReviewDto) {
    await this.owner(user, workspaceId);
    if (dto.status === 'try_again' && !dto.feedback?.trim()) throw new BadRequestException('Add a short comment so the student knows what to change.');
    const { data, error } = await this.db(user).from('lms_submissions').update({ status: dto.status, feedback: dto.feedback?.trim() || null, reviewed_by: user.id, reviewed_at: new Date().toISOString() }).eq('workspace_id', workspaceId).eq('id', submissionId).eq('status', 'pending').select('id,status').maybeSingle();
    if (error) this.fail(error);
    if (!data) throw new ConflictException('This submission was already reviewed.');
    return data;
  }

  // ---------- student (and owner preview) ----------
  async getLesson(user: AuthUser, workspaceId: string, lessonId: string) {
    const db = this.db(user);
    const [lesson, progress, subs] = await Promise.all([
      db.from('lms_lessons').select('*').eq('workspace_id', workspaceId).eq('id', lessonId).maybeSingle(),
      db.from('lms_progress').select('checklist_done,done_at').eq('lesson_id', lessonId).eq('user_id', user.id).maybeSingle(),
      db.from('lms_submissions').select('id,photo_path,note,status,feedback,created_at').eq('lesson_id', lessonId).eq('user_id', user.id).order('created_at', { ascending: false }).limit(10)
    ]);
    if (lesson.error) this.fail(lesson.error);
    if (!lesson.data) throw new NotFoundException('Lesson not found');
    return { role: await this.role(user, workspaceId), lesson: lesson.data, video: videoInfo(lesson.data.video_url), progress: progress.data ?? { checklist_done: [], done_at: null }, submissions: await Promise.all((subs.data ?? []).map((s: any) => this.withPhoto(s))) };
  }

  async saveProgress(user: AuthUser, workspaceId: string, lessonId: string, dto: ProgressDto) {
    const db = this.db(user);
    const { data: lesson } = await db.from('lms_lessons').select('id,checklist').eq('workspace_id', workspaceId).eq('id', lessonId).maybeSingle();
    if (!lesson) throw new NotFoundException('Lesson not found');
    const max = Array.isArray(lesson.checklist) ? lesson.checklist.length : 0;
    const row: Record<string, unknown> = { workspace_id: workspaceId, lesson_id: lessonId, user_id: user.id, updated_at: new Date().toISOString() };
    if (dto.checklistDone) row.checklist_done = Array.from(new Set(dto.checklistDone.filter((i) => i >= 0 && i < max)));
    if (dto.done !== undefined) row.done_at = dto.done ? new Date().toISOString() : null;
    const { data, error } = await db.from('lms_progress').upsert(row, { onConflict: 'lesson_id,user_id' }).select('checklist_done,done_at').single();
    if (error) this.fail(error);
    return data;
  }

  async submit(user: AuthUser, workspaceId: string, lessonId: string, dto: SubmissionDto) {
    if (!dto.photoBase64 && !dto.note?.trim()) throw new BadRequestException('Add a photo or a note.');
    const db = this.db(user);
    const { data: lesson } = await db.from('lms_lessons').select('id').eq('workspace_id', workspaceId).eq('id', lessonId).maybeSingle();
    if (!lesson) throw new NotFoundException('Lesson not found');
    let photoPath: string | null = null;
    if (dto.photoBase64) {
      let photo;
      try { photo = decodePracticePhoto(dto.photoBase64); } catch (e) { throw new BadRequestException(e instanceof Error ? e.message : 'Photo not accepted.'); }
      photoPath = `${workspaceId}/${user.id}/${randomUUID()}.${photo.ext}`;
      const up = await createServiceSupabaseClient().storage.from(BUCKET).upload(photoPath, photo.buffer, { contentType: photo.contentType, upsert: false });
      if (up.error) throw new ConflictException(/not found/i.test(up.error.message) ? `Photo upload needs the database update ${MIGRATION} (waiting for Angel's yes).` : 'The photo could not be uploaded. Please try again.');
    }
    const { data, error } = await db.from('lms_submissions').insert({ workspace_id: workspaceId, lesson_id: lessonId, user_id: user.id, photo_path: photoPath, note: dto.note?.trim() || null }).select('id,status,created_at').single();
    if (error) this.fail(error);
    return data;
  }

  private async withPhoto(row: any) {
    if (!row.photo_path) return { ...row, photoUrl: null };
    const signed = await createServiceSupabaseClient().storage.from(BUCKET).createSignedUrl(row.photo_path, 600).catch(() => null);
    return { ...row, photoUrl: signed?.data?.signedUrl ?? null };
  }
}
