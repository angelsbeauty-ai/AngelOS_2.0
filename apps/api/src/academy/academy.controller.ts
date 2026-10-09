import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { AcademyService } from './academy.service';
import { CourseDto, EnrollDto, LessonDto, ProgressDto, ReorderDto, ReviewDto, StudentInviteDto, SubmissionDto } from './dto/academy.dto';

@Controller('workspaces/:workspaceId/academy')
@UseGuards(SupabaseAuthGuard)
export class AcademyController {
  constructor(private readonly academy: AcademyService) {}
  @Get('courses') courses(@CurrentUser() u: AuthUser, @Param('workspaceId') ws: string) { return this.academy.listCourses(u, ws); }
  @Post('courses') createCourse(@CurrentUser() u: AuthUser, @Param('workspaceId') ws: string, @Body() dto: CourseDto) { return this.academy.createCourse(u, ws, dto); }
  @Get('courses/:courseId') course(@CurrentUser() u: AuthUser, @Param('workspaceId') ws: string, @Param('courseId') id: string) { return this.academy.getCourse(u, ws, id); }
  @Patch('courses/:courseId') updateCourse(@CurrentUser() u: AuthUser, @Param('workspaceId') ws: string, @Param('courseId') id: string, @Body() dto: CourseDto) { return this.academy.updateCourse(u, ws, id, dto); }
  @Delete('courses/:courseId') deleteCourse(@CurrentUser() u: AuthUser, @Param('workspaceId') ws: string, @Param('courseId') id: string) { return this.academy.deleteCourse(u, ws, id); }
  @Post('courses/:courseId/lessons') addLesson(@CurrentUser() u: AuthUser, @Param('workspaceId') ws: string, @Param('courseId') id: string, @Body() dto: LessonDto) { return this.academy.addLesson(u, ws, id, dto); }
  @Post('courses/:courseId/reorder') reorder(@CurrentUser() u: AuthUser, @Param('workspaceId') ws: string, @Param('courseId') id: string, @Body() dto: ReorderDto) { return this.academy.reorder(u, ws, id, dto.lessonIds); }
  @Post('courses/:courseId/enroll') enroll(@CurrentUser() u: AuthUser, @Param('workspaceId') ws: string, @Param('courseId') id: string, @Body() dto: EnrollDto) { return this.academy.enroll(u, ws, id, dto.userId); }
  @Post('courses/:courseId/unenroll') unenroll(@CurrentUser() u: AuthUser, @Param('workspaceId') ws: string, @Param('courseId') id: string, @Body() dto: EnrollDto) { return this.academy.enroll(u, ws, id, dto.userId, true); }
  @Get('lessons/:lessonId') lesson(@CurrentUser() u: AuthUser, @Param('workspaceId') ws: string, @Param('lessonId') id: string) { return this.academy.getLesson(u, ws, id); }
  @Patch('lessons/:lessonId') updateLesson(@CurrentUser() u: AuthUser, @Param('workspaceId') ws: string, @Param('lessonId') id: string, @Body() dto: LessonDto) { return this.academy.updateLesson(u, ws, id, dto); }
  @Delete('lessons/:lessonId') deleteLesson(@CurrentUser() u: AuthUser, @Param('workspaceId') ws: string, @Param('lessonId') id: string) { return this.academy.deleteLesson(u, ws, id); }
  @Post('lessons/:lessonId/progress') progress(@CurrentUser() u: AuthUser, @Param('workspaceId') ws: string, @Param('lessonId') id: string, @Body() dto: ProgressDto) { return this.academy.saveProgress(u, ws, id, dto); }
  @Post('lessons/:lessonId/submissions') submit(@CurrentUser() u: AuthUser, @Param('workspaceId') ws: string, @Param('lessonId') id: string, @Body() dto: SubmissionDto) { return this.academy.submit(u, ws, id, dto); }
  @Get('students') students(@CurrentUser() u: AuthUser, @Param('workspaceId') ws: string) { return this.academy.students(u, ws); }
  @Post('students/invite') invite(@CurrentUser() u: AuthUser, @Param('workspaceId') ws: string, @Body() dto: StudentInviteDto) { return this.academy.studentInvite(u, ws, dto.label); }
  @Get('submissions') submissions(@CurrentUser() u: AuthUser, @Param('workspaceId') ws: string, @Query('status') status?: string) { return this.academy.submissions(u, ws, status && ['pending', 'approved', 'try_again'].includes(status) ? status : 'pending'); }
  @Post('submissions/:submissionId/review') review(@CurrentUser() u: AuthUser, @Param('workspaceId') ws: string, @Param('submissionId') id: string, @Body() dto: ReviewDto) { return this.academy.review(u, ws, id, dto); }
}
