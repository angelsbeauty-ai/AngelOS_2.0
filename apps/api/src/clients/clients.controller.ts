import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { CreateHealthFormDto } from './dto/health-form.dto';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { CreateClientNoteDto } from './dto/create-note.dto';
import { CreateTreatmentDto } from './dto/create-treatment.dto';
import { CreateConsentDto } from './dto/create-consent.dto';

@Controller('workspaces/:workspaceId/clients')
@UseGuards(SupabaseAuthGuard)
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string, @Query('search') search?: string, @Query('status') status?: string, @Query('archived') archived?: string, @Query('touchUpDue') touchUpDue?: string) {
    return this.clients.list(user, workspaceId, search, { status: status && /^[a-z_]{2,20}$/.test(status) ? status : undefined, archived: archived === 'true', touchUpDue: touchUpDue === 'true' });
  }

  @Post(':clientId/archive')
  archive(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string, @Param('clientId') clientId: string) { return this.clients.setArchived(user, workspaceId, clientId, true); }

  @Post(':clientId/unarchive')
  unarchive(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string, @Param('clientId') clientId: string) { return this.clients.setArchived(user, workspaceId, clientId, false); }

  @Get(':clientId/health-forms')
  healthForms(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string, @Param('clientId') clientId: string) { return this.clients.listHealthForms(user, workspaceId, clientId); }

  @Post(':clientId/health-forms')
  addHealthForm(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string, @Param('clientId') clientId: string, @Body() dto: CreateHealthFormDto) { return this.clients.addHealthForm(user, workspaceId, clientId, dto); }

  @Post()
  create(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string, @Body() dto: CreateClientDto) {
    return this.clients.create(user, workspaceId, dto);
  }

  @Get(':clientId')
  get(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string, @Param('clientId') clientId: string) {
    return this.clients.get(user, workspaceId, clientId);
  }

  @Patch(':clientId')
  update(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string, @Param('clientId') clientId: string, @Body() dto: UpdateClientDto) {
    return this.clients.update(user, workspaceId, clientId, dto);
  }

  @Post(':clientId/notes')
  addNote(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string, @Param('clientId') clientId: string, @Body() dto: CreateClientNoteDto) {
    return this.clients.addNote(user, workspaceId, clientId, dto);
  }

  @Post(':clientId/treatments')
  addTreatment(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string, @Param('clientId') clientId: string, @Body() dto: CreateTreatmentDto) {
    return this.clients.addTreatment(user, workspaceId, clientId, dto);
  }

  @Post(':clientId/consents')
  addConsent(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string, @Param('clientId') clientId: string, @Body() dto: CreateConsentDto) {
    return this.clients.addConsent(user, workspaceId, clientId, dto);
  }
}
