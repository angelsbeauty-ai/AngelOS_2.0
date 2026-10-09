import { Body, Controller, Get, Header, Param, Post, Query, UseGuards } from '@nestjs/common';
import { RecordExpenseDto } from './dto/record-expense.dto';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { RecordFinanceEntryDto } from './dto/record-finance-entry.dto';
import { FinanceService } from './finance.service';

@Controller('workspaces/:workspaceId/finance')
@UseGuards(SupabaseAuthGuard)
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get('summary') summary(@CurrentUser() user: AuthUser, @Param('workspaceId') ws: string) { return this.finance.summary(user, ws); }
  @Post('expenses') expense(@CurrentUser() user: AuthUser, @Param('workspaceId') ws: string, @Body() dto: RecordExpenseDto) { return this.finance.recordExpense(user, ws, dto); }
  @Get('export.csv') @Header('Content-Type', 'text/csv; charset=utf-8') @Header('Content-Disposition', 'attachment; filename="angelos-money.csv"')
  exportCsv(@CurrentUser() user: AuthUser, @Param('workspaceId') ws: string, @Query('days') days?: string) { return this.finance.exportCsv(user, ws, Number(days) || 90); }

  @Get('overview') overview(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string, @Query('days') days?: string) {
    return this.finance.overview(user, workspaceId, Number(days ?? 30));
  }

  @Get('appointments/:appointmentId') appointment(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string, @Param('appointmentId') appointmentId: string) {
    return this.finance.appointmentSummary(user, workspaceId, appointmentId);
  }

  @Post('entries') record(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string, @Body() dto: RecordFinanceEntryDto) {
    return this.finance.recordEntry(user, workspaceId, dto);
  }
}
