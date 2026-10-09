import { Module } from '@nestjs/common';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { AcademyController } from './academy.controller';
import { AcademyService } from './academy.service';
@Module({ controllers: [AcademyController], providers: [AcademyService, SupabaseAuthGuard] })
export class AcademyModule {}
