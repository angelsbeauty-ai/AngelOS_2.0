/** B5/B6 pure money + business metrics. Amounts are plain numbers in the workspace currency. */

export interface PaymentRow { entry_type: string; amount: number | string; method?: string | null; occurred_at: string; correction_effect?: string | null; appointment_id?: string | null; client_id?: string | null }
export interface AppointmentRow { id: string; client_id: string; service_name: string; status: string; start_at: string; price_snapshot: number | string; created_at?: string }

export function incomeEffect(row: PaymentRow) {
  const amount = Number(row.amount || 0);
  if (row.entry_type === 'deposit' || row.entry_type === 'payment') return amount;
  if (row.entry_type === 'refund') return -amount;
  if (row.entry_type === 'correction' && row.correction_effect === 'increase_income') return amount;
  if (row.entry_type === 'correction' && row.correction_effect === 'decrease_income') return -amount;
  return 0;
}

/** Completed bookings that are not fully paid yet ("Who still owes"). */
export function whoOwes(appointments: AppointmentRow[], payments: PaymentRow[]) {
  const paid = new Map<string, number>();
  const discounts = new Map<string, number>();
  for (const p of payments) {
    if (!p.appointment_id) continue;
    paid.set(p.appointment_id, (paid.get(p.appointment_id) ?? 0) + incomeEffect(p));
    if (p.entry_type === 'discount') discounts.set(p.appointment_id, (discounts.get(p.appointment_id) ?? 0) + Number(p.amount || 0));
  }
  return appointments
    .filter((a) => a.status === 'completed')
    .map((a) => ({ appointmentId: a.id, clientId: a.client_id, service: a.service_name, startAt: a.start_at, due: Math.max(0, Number(a.price_snapshot) - (discounts.get(a.id) ?? 0) - (paid.get(a.id) ?? 0)) }))
    .filter((row) => row.due > 0)
    .sort((x, y) => y.startAt.localeCompare(x.startAt));
}

export function sumSince(rows: PaymentRow[], sinceMs: number) {
  return rows.filter((r) => Date.parse(r.occurred_at) >= sinceMs).reduce((sum, r) => sum + incomeEffect(r), 0);
}

/** Business numbers for Insights. `history` = all bookings of the clients seen in the period (for new vs returning / rebook). */
export function businessMetrics(input: { now: Date; days: number; appointments: AppointmentRow[]; history: AppointmentRow[]; payments: PaymentRow[] }) {
  const now = input.now.getTime();
  const start = now - input.days * 86400000;
  const prevStart = start - input.days * 86400000;
  const inPeriod = input.appointments.filter((a) => Date.parse(a.start_at) >= start && Date.parse(a.start_at) <= now);
  const done = inPeriod.filter((a) => a.status === 'completed');
  const noShows = inPeriod.filter((a) => a.status === 'no_show').length;
  const decided = done.length + noShows;
  const firstVisit = new Map<string, number>();
  for (const a of input.history) {
    if (!['completed', 'confirmed', 'checked_in', 'arrival_info_sent', 'confirmation_pending'].includes(a.status)) continue;
    const t = Date.parse(a.start_at);
    if (!firstVisit.has(a.client_id) || t < firstVisit.get(a.client_id)!) firstVisit.set(a.client_id, t);
  }
  const clients = new Set(inPeriod.filter((a) => a.status !== 'cancelled').map((a) => a.client_id));
  let newClients = 0;
  for (const c of clients) if ((firstVisit.get(c) ?? now) >= start) newClients += 1;
  // Rebook: of clients with a completed visit in the period, how many have another booking within 90 days after it.
  let rebooked = 0;
  const completedClients = new Map<string, number>();
  for (const a of done) completedClients.set(a.client_id, Math.max(completedClients.get(a.client_id) ?? 0, Date.parse(a.start_at)));
  for (const [clientId, at] of completedClients) {
    if (input.history.some((h) => h.client_id === clientId && h.status !== 'cancelled' && Date.parse(h.start_at) > at && Date.parse(h.start_at) <= at + 90 * 86400000)) rebooked += 1;
  }
  const incomeByService: Record<string, number> = {};
  const byAppointment = new Map(input.appointments.map((a) => [a.id, a.service_name]));
  for (const p of input.payments) {
    if (Date.parse(p.occurred_at) < start) continue;
    const key = (p.appointment_id && byAppointment.get(p.appointment_id)) || 'Other';
    incomeByService[key] = (incomeByService[key] ?? 0) + incomeEffect(p);
  }
  const income = sumSince(input.payments.filter((p) => Date.parse(p.occurred_at) <= now), start);
  const prevIncome = input.payments.filter((p) => Date.parse(p.occurred_at) >= prevStart && Date.parse(p.occurred_at) < start).reduce((s, p) => s + incomeEffect(p), 0);
  return {
    days: input.days,
    bookings: inPeriod.filter((a) => a.status !== 'cancelled').length,
    completed: done.length,
    cancelled: inPeriod.filter((a) => a.status === 'cancelled').length,
    noShows,
    noShowRate: decided ? Math.round((noShows / decided) * 100) : null,
    newClients,
    returningClients: clients.size - newClients,
    rebookRate: completedClients.size ? Math.round((rebooked / completedClients.size) * 100) : null,
    income,
    previousIncome: prevIncome,
    incomeChange: prevIncome ? Math.round(((income - prevIncome) / prevIncome) * 100) : null,
    incomeByService: Object.entries(incomeByService).filter(([, v]) => v !== 0).sort((a, b) => b[1] - a[1]).map(([service, amount]) => ({ service, amount }))
  };
}

function csvCell(value: unknown) {
  const s = value == null ? '' : String(value);
  // Prevent spreadsheet formula injection and quote everything.
  const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function toCsv(rows: Array<Record<string, unknown>>, columns: string[]) {
  return [columns.map(csvCell).join(','), ...rows.map((r) => columns.map((c) => csvCell(r[c])).join(','))].join('\r\n') + '\r\n';
}
