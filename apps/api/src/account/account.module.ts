import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Injectable, InternalServerErrorException, Module, NotFoundException, Param, Patch, UseGuards } from '@nestjs/common';
import { Equals, IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { createServiceSupabaseClient, createUserSupabaseClient } from '../config/supabase';
import { BetaModule } from '../beta/beta.module';
import { BetaService } from '../beta/beta.service';

export class UpdateMeDto {
  @IsOptional() @IsString() @Length(1, 80) displayName?: string;
  @IsOptional() @IsIn(['en', 'ja']) language?: 'en' | 'ja';
}
export class UpdateWorkspaceDto {
  @IsOptional() @IsString() @Length(1, 120) name?: string;
  @IsOptional() @IsIn(['JPY', 'USD', 'EUR', 'GBP', 'AUD', 'KRW', 'TWD', 'HKD', 'SGD']) currency?: string;
  @IsOptional() @IsString() @MaxLength(60) timezone?: string;
  @IsOptional() @IsIn(['en', 'ja', 'en-JP', 'ja-JP']) locale?: string;
}
export class DeleteMeDto { @Equals('DELETE') confirm!: string; }

/** B9/B11 account: who am I, my roles, profile, business settings, delete account. */
@Injectable()
export class AccountService {
  constructor(private readonly beta: BetaService) {}

  async me(user: AuthUser) {
    const service = createServiceSupabaseClient();
    const [{ data: members, error }, auth] = await Promise.all([
      service.from('workspace_memberships').select('workspace_id,role,workspace:workspaces(name)').eq('user_id', user.id),
      service.auth.admin.getUserById(user.id)
    ]);
    if (error) throw new InternalServerErrorException(error.message);
    const meta = (auth.data?.user?.user_metadata ?? {}) as Record<string, unknown>;
    return {
      userId: user.id, email: user.email ?? null, founder: await this.beta.isFounder(user.id),
      displayName: typeof meta.display_name === 'string' ? meta.display_name : null,
      language: meta.language === 'ja' ? 'ja' : meta.language === 'en' ? 'en' : null,
      memberships: (members ?? []).map((m: any) => ({ workspaceId: m.workspace_id, role: m.role === 'student' ? 'student' : 'owner', workspaceName: m.workspace?.name ?? null }))
    };
  }

  async updateMe(user: AuthUser, dto: UpdateMeDto) {
    const service = createServiceSupabaseClient();
    const current = await service.auth.admin.getUserById(user.id);
    const meta = { ...(current.data?.user?.user_metadata ?? {}) } as Record<string, unknown>;
    if (dto.displayName !== undefined) meta.display_name = dto.displayName.trim();
    if (dto.language !== undefined) meta.language = dto.language;
    const { error } = await service.auth.admin.updateUserById(user.id, { user_metadata: meta });
    if (error) throw new InternalServerErrorException(error.message);
    return this.me(user);
  }

  async updateWorkspace(user: AuthUser, workspaceId: string, dto: UpdateWorkspaceDto) {
    if (dto.timezone) { try { new Intl.DateTimeFormat('en', { timeZone: dto.timezone }); } catch { throw new BadRequestException('Unknown time zone'); } }
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries({ name: dto.name?.trim(), currency: dto.currency, timezone: dto.timezone, locale: dto.locale })) if (v !== undefined) patch[k] = v;
    const supabase = createUserSupabaseClient(user.accessToken);
    const { data: m } = await supabase.from('workspace_memberships').select('role').eq('workspace_id', workspaceId).eq('user_id', user.id).maybeSingle();
    if (!m) throw new NotFoundException('Workspace not found');
    if (m.role !== 'owner') throw new ForbiddenException('Only the studio owner can change business settings.');
    const { data, error } = await supabase.from('workspaces').update(patch).eq('id', workspaceId).select('id,name,business_type,timezone,currency,locale').maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    if (!data) throw new NotFoundException('Workspace not found');
    return data;
  }

  /** Deletes the user's OWN studios (all their data, by cascade) and then the login. Student memberships elsewhere just end. */
  async deleteMe(user: AuthUser) {
    if (await this.beta.isFounder(user.id)) throw new ForbiddenException('Founder accounts cannot be deleted from the app.');
    const service = createServiceSupabaseClient();
    const { data: owned, error } = await service.from('workspace_memberships').select('workspace_id').eq('user_id', user.id).eq('role', 'owner');
    if (error) throw new InternalServerErrorException(error.message);
    for (const row of owned ?? []) {
      const { count } = await service.from('workspace_memberships').select('user_id', { count: 'exact', head: true }).eq('workspace_id', row.workspace_id).eq('role', 'owner').neq('user_id', user.id);
      if (!count) {
        const del = await service.from('workspaces').delete().eq('id', row.workspace_id);
        if (del.error) throw new InternalServerErrorException(`Could not delete studio data: ${del.error.message}`);
      }
    }
    const { error: authError } = await service.auth.admin.deleteUser(user.id);
    if (authError) throw new InternalServerErrorException(authError.message);
    return { deleted: true };
  }
}

@Controller()
@UseGuards(SupabaseAuthGuard)
export class AccountController {
  constructor(private readonly account: AccountService) {}
  @Get('me') me(@CurrentUser() user: AuthUser) { return this.account.me(user); }
  @Patch('me') updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateMeDto) { return this.account.updateMe(user, dto); }
  @Delete('me') deleteMe(@CurrentUser() user: AuthUser, @Body() _dto: DeleteMeDto) { return this.account.deleteMe(user); }
  @Patch('workspaces/:workspaceId') updateWorkspace(@CurrentUser() user: AuthUser, @Param('workspaceId') ws: string, @Body() dto: UpdateWorkspaceDto) { return this.account.updateWorkspace(user, ws, dto); }
}

@Module({ imports: [BetaModule], controllers: [AccountController], providers: [AccountService, SupabaseAuthGuard] })
export class AccountModule {}
