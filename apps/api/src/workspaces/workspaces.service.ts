import { ConflictException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { createUserSupabaseClient } from '../config/supabase';
import type { AuthUser } from '../auth/auth-user';
import type { CreateWorkspaceDto } from './create-workspace.dto';
import { BetaService } from '../beta/beta.service';

@Injectable()
export class WorkspacesService {
  constructor(private readonly beta: BetaService) {}

  async create(user: AuthUser, dto: CreateWorkspaceDto) {
    await this.beta.ensureCanCreateWorkspace(user);
    // V1 is intentionally one owner / one main business workspace. The schema remains multi-workspace-ready for later.
    const existing = await this.list(user);
    if (existing.length) throw new ConflictException('AngelOS V1 supports one main business workspace per account. Multi-business switching is planned for a later version.');
    // Use a user-scoped Supabase client so RLS remains part of the protection model.
    const supabase = createUserSupabaseClient(user.accessToken);

    const { data, error } = await supabase.rpc('create_workspace_with_owner', {
      p_name: dto.name,
      p_business_type: dto.businessType ?? null,
      p_timezone: dto.timezone,
      p_currency: dto.currency,
      p_locale: dto.locale
    });

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return data;
  }

  async list(user: AuthUser) {
    const supabase = createUserSupabaseClient(user.accessToken);
    const { data, error } = await supabase
      .from('workspace_memberships')
      .select('role,workspace:workspaces(id,name,business_type,timezone,currency,locale)')
      .eq('user_id', user.id);

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    // Owner studios first, then studios where the user is a student.
    return (data ?? []).filter((row: any) => row.workspace).map((row: any) => ({ ...row.workspace, role: row.role === 'student' ? 'student' : 'owner' })).sort((a: any, b: any) => (a.role === b.role ? 0 : a.role === 'owner' ? -1 : 1));
  }
}
