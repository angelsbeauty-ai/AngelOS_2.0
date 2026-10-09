import { Tabs } from '../src/components/Field';
import { getActiveWorkspace } from '../src/lib/workspace';
import { inviteLink } from '../src/lib/academy';
import { useEffect, useState } from 'react';
import { Platform, Pressable, Share, StyleSheet, Switch, Text, View } from 'react-native';
import { dialog } from '../src/lib/dialog';
import { Screen } from '../src/components/Screen';
import { Badge, BodyText, Button, Card, Header, ListRow, Overline, SectionTitle, StatTile, SupportText, TextField, ui } from '../src/components/ui';
import { createStudentDiscount, getBrainAggregates, getFounderOverview, type BrainAggregateTopic, listFeatureFlags, listFounderWorkspaces, updateFeatureFlag } from '../src/lib/founder';
import { createBetaInvite, getFounderBetaOverview, listBetaFeedback, listBetaInvites, revokeBetaInvite, revokeBetaTester, type BetaOverview } from '../src/lib/beta';

export default function FounderAdminScreen() {
  const [overview, setOverview] = useState<any>(null);
  const [beta, setBeta] = useState<BetaOverview | null>(null);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [flags, setFlags] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<any[]>([]);
  const [brain, setBrain] = useState<{ topics: BrainAggregateTopic[]; needsMigration: string | null } | null>(null);
  const [email, setEmail] = useState('');
  const [inviteLabel, setInviteLabel] = useState('');
  const [inviteRegion, setInviteRegion] = useState('');
  const [inviteType, setInviteType] = useState<'business_owner'|'student'>('business_owner');
  const [inviteCohort, setInviteCohort] = useState<'student'|'outside'|'partner'|'angels_beauty'>('outside');
  const [lastToken, setLastToken] = useState<string | null>(null);
  const [section, setSection] = useState<'overview'|'invites'|'feedback'|'flags'|'discounts'>('overview');
  const [lastBetaToken, setLastBetaToken] = useState<string | null>(null);
  useEffect(() => { void load(); }, []);
  async function load() {
    try {
      const [o,b,w,f,i,fb] = await Promise.all([getFounderOverview(), getFounderBetaOverview(), listFounderWorkspaces(), listFeatureFlags(), listBetaInvites(), listBetaFeedback()]);
      setOverview(o); setBeta(b); setWorkspaces(w); setFlags(f); setInvites(i); setFeedback(fb);
      setBrain(await getBrainAggregates().catch(() => null));
    } catch (error) { void dialog.notify('Founder Admin unavailable', error instanceof Error ? error.message : 'Unknown error'); }
  }
  async function toggleFlag(flag:any, enabled:boolean) { try { await updateFeatureFlag(flag.key,{ enabled, stage: enabled && ['off','paused'].includes(flag.stage) ? 'beta' : flag.stage }); await load(); } catch (error) { void dialog.notify('Could not update feature', error instanceof Error ? error.message : 'Unknown error'); } }
  async function makeStudentDiscount() { try { const created=await createStudentDiscount({emailHint:email.trim()||undefined,discountPercent:20}); setLastToken(created.token); setEmail(''); } catch(error){void dialog.notify('Could not create student discount',error instanceof Error?error.message:'Unknown error');} }
  async function shareInvite(token: string) {
    const url = inviteLink(token);
    const nav: any = Platform.OS === 'web' ? (globalThis as any).navigator : null;
    try {
      if (nav?.share) await nav.share({ title: 'Your AngelOS invite', url });
      else if (nav?.clipboard) { await nav.clipboard.writeText(url); void dialog.notify('Invite link copied', 'Send it to the person. It works once.'); }
      else await Share.share({ message: url });
    } catch { /* user closed the share sheet */ }
  }
  async function makeBetaInvite() { try { const created=await createBetaInvite({ emailHint: email.trim() || undefined, cohort:inviteCohort, label: inviteLabel.trim() || undefined, region: inviteRegion.trim() || undefined, expiresInDays: 60, inviteType, workspaceId: inviteType==='student' ? (await getActiveWorkspace()).id : undefined }); setLastBetaToken(created.token); void shareInvite(created.token); setInviteLabel(''); setInviteRegion(''); setEmail(''); await load(); } catch(error){void dialog.notify('Could not create beta invite',error instanceof Error?error.message:'Unknown error');} }
  async function revokeInvite(id:string){ try{ await revokeBetaInvite(id); await load(); }catch(error){void dialog.notify('Could not revoke invite',error instanceof Error?error.message:'Unknown error');} }
  async function revokeTester(userId:string){ const ok=await dialog.confirm({title:'Revoke beta access?',message:'The tester workspace will become read-only. Their data will not be deleted.',cancelText:'Keep access',confirmText:'Revoke access',destructive:true}); if(!ok)return; try{await revokeBetaTester(userId);await load();}catch(error){void dialog.notify('Could not revoke beta access',error instanceof Error?error.message:'Unknown error');} }

  const SECTIONS = [{id:'overview' as const,label:'Overview'},{id:'invites' as const,label:'Invites & testers'},{id:'feedback' as const,label:'Feedback'},{id:'flags' as const,label:'Feature flags'},{id:'discounts' as const,label:'Discount codes'}];
  return <Screen onRefresh={load}><View style={styles.stack}>
    <Header eyebrow="Founder only" title="Founder controls" subtitle="Platform health, beta access and rollouts only. Client records, conversations and private business content are never shown here." />
    <Tabs value={section} options={SECTIONS} onChange={setSection} />

    {section==='overview' ? <>
      <Card premium><View style={styles.headerRow}><View style={styles.headerCopy}><SectionTitle>Platform overview</SectionTitle><SupportText>A privacy-safe view across AngelOS.</SupportText></View><Badge status="confirmed" label="Controlled" /></View>
      <View style={styles.grid}><StatTile label="Workspaces" value={overview?.counts?.workspaces ?? '—'}/><StatTile label="Trialing" value={overview?.counts?.trialing ?? '—'}/><StatTile label="Paid" value={overview?.counts?.active ?? '—'}/><StatTile label="Read only" value={overview?.counts?.readOnly ?? '—'}/></View></Card>
      <Card>
        <Overline>Release gate</Overline><SectionTitle>Invite-only beta</SectionTitle>
        <Text style={styles.big}>{beta?.readiness ? humanize(beta.readiness) : '—'}</Text>
        <SupportText>Public launch is never automatic. Even when every gate passes, Founder approval is still required.</SupportText>
        <View style={styles.grid}><StatTile label="Approved testers" value={beta?.counts.approvedTesters ?? 0}/><StatTile label="Outside businesses" value={beta?.counts.outsideBusinesses ?? 0}/><StatTile label="Outside active · 30d" value={beta?.counts.activeOutside30d ?? 0}/><StatTile label="Reviews allowed" value={beta?.counts.testimonialCandidates ?? 0}/></View>
        {beta?.criteria.map((item)=><View key={item.key} style={styles.row}><BodyText>{item.pass?'✓':'○'} {item.label}</BodyText><SupportText>{String(item.current ?? '—')} / {item.target}</SupportText></View>)}
      </Card>
      <Card><SectionTitle>Usage · last 30 days</SectionTitle><BodyText>{overview?.usage30d?.activeWorkspaces ?? 0} active workspaces · {overview?.usage30d?.events ?? 0} privacy-safe usage events</BodyText>{overview?.usage30d?.topScreens?.slice(0,5).map((row:any)=><View style={styles.row} key={row.screen}><BodyText>{row.screen}</BodyText><SupportText>{row.views} views</SupportText></View>)}</Card>
      <Card><SectionTitle>AngelOS brain · anonymised</SectionTitle><SupportText>What studios and their clients ask for most, as counts only (last 90 days). No studio names, people, emails or message text.</SupportText>{brain?.needsMigration?<SupportText>Starts after database update {brain.needsMigration}.</SupportText>:null}{brain && !brain.needsMigration && brain.topics.length===0?<SupportText>No data yet.</SupportText>:null}{(['client_request','owner_request','owner_preference'] as const).map((kind)=>{const rows=(brain?.topics??[]).filter((t)=>t.kind===kind).slice(0,6); if(!rows.length)return null; return <View key={kind} style={{gap:4}}><Text style={styles.bold}>{kind==='client_request'?'Clients ask about':kind==='owner_request'?'Owners ask AngelOS for':'Owners prefer'}</Text>{rows.map((row)=><View style={styles.row} key={row.topic}><BodyText>{row.label}</BodyText><SupportText>{row.workspaces} studio{row.workspaces===1?'':'s'} · {row.requests}×</SupportText></View>)}</View>;})}</Card>
      <Card><SectionTitle>Recent workspaces</SectionTitle>{workspaces.slice(0,10).map((workspace)=><ListRow key={workspace.id} title={workspace.name} subtitle={`${workspace.subscription?.status ?? 'unknown'} · ${workspace.attentionCount} open attention item${workspace.attentionCount===1?'':'s'}`} />)}</Card>
      <Card><Badge status="no_show" label="Safety boundary" /><SectionTitle>What Founder controls never expose</SectionTitle><SupportText>Private client details, treatment notes, subscriber messages, financial records and workspace content stay isolated. Emergency pause and audit evidence stay in the Safety Center.</SupportText></Card>
    </> : null}

    {section==='invites' ? <Card>
      <SectionTitle>Approve a beta business or student</SectionTitle>
      <SupportText>Creates one private invite link. Unused invites expire in 60 days. Outside businesses get a 60-day beta window; student testers get 30 days.</SupportText>
      <TextField label="Approved email (recommended)" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <TextField label="Business / tester label" value={inviteLabel} onChangeText={setInviteLabel} />
      <TextField label="Region, e.g. Manila or Tokyo" value={inviteRegion} onChangeText={setInviteRegion} />
      <Tabs value={inviteType} options={[{id:'business_owner',label:'Business owner'},{id:'student',label:'Student (joins my Academy)'}]} onChange={setInviteType} />
      <Tabs value={inviteCohort} options={(['outside','student','partner','angels_beauty'] as const).map((v)=>({id:v,label:humanize(v)}))} onChange={setInviteCohort} />
      <Button label="Create invite" onPress={()=>void makeBetaInvite()} />
      {lastBetaToken ? <View style={styles.token}><Text style={styles.bold}>Share this link once:</Text><Text selectable>{inviteLink(lastBetaToken)}</Text><Button small variant="secondary" label="Copy / share link" onPress={()=>void shareInvite(lastBetaToken)} /></View>:null}
      {invites.slice(0,8).map((invite)=><ListRow key={invite.id} title={invite.label || invite.email_hint || 'Approved beta tester'} subtitle={`${invite.cohort} · ${invite.region || 'region not set'} · ${invite.redeemed_at?'redeemed':invite.revoked_at?'revoked':'unused'}`} chevron={false} trailing={!invite.redeemed_at&&!invite.revoked_at?<Button small variant="danger" label="Revoke invite" onPress={()=>void revokeInvite(invite.id)} />:invite.redeemed_by?<Button small variant="danger" label="Revoke access" onPress={()=>void revokeTester(invite.redeemed_by)} />:undefined} />)}
    </Card> : null}

    {section==='feedback' ? <Card><SectionTitle>Beta feedback</SectionTitle><SupportText>{feedback.length} recent item{feedback.length===1?'':'s'}. Quote permission is separate from ordinary feedback.</SupportText>{feedback.length===0?<SupportText>No feedback yet.</SupportText>:null}{feedback.slice(0,10).map((item)=><ListRow key={item.id} title={`${humanize(item.category)} · ${item.rating ? `${item.rating}/5` : 'no rating'}`} subtitle={`${item.message}\n${item.permission_to_quote?'Public quote allowed':'Private only'} · ${item.status}`} chevron={false} />)}</Card> : null}

    {section==='flags' ? <Card premium><Badge status="request" label="Approval required" /><SectionTitle>Platform feature controls</SectionTitle><SupportText>A rollout never becomes public automatically. Every stage stays Founder-controlled and reversible.</SupportText>{flags.map((flag)=><View key={flag.key} style={styles.flag}><View style={{flex:1}}><Text style={styles.bold}>{flag.name}</Text><SupportText>{flag.description} · {flag.stage}</SupportText></View><Switch accessibilityLabel={flag.name} value={flag.enabled && !['off','paused'].includes(flag.stage)} trackColor={{false:ui.colors.border,true:ui.colors.softGold}} thumbColor={flag.enabled?ui.colors.gold:ui.colors.secondaryText} onValueChange={(value)=>void toggleFlag(flag,value)}/></View>)}</Card> : null}

    {section==='discounts' ? <Card><SectionTitle>Student discount</SectionTitle><SupportText>Creates a one-time private 20% token for a verified Angels Beauty student or alumnus.</SupportText><TextField label="Student email (optional)" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" /><Button label="Create private discount token" onPress={()=>void makeStudentDiscount()} />{lastToken ? <View style={styles.token}><Text style={styles.bold}>Share this token once:</Text><Text selectable>{lastToken}</Text></View> : null}</Card> : null}
  </View></Screen>;
}
function humanize(value:string){return value.replaceAll('_',' ').replace(/\b\w/g,(c)=>c.toUpperCase());}
const styles=StyleSheet.create({stack:{gap:ui.spacing.sm},headerRow:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',gap:ui.spacing.sm},headerCopy:{flex:1,gap:2},grid:{flexDirection:'row',flexWrap:'wrap',gap:ui.spacing.xs},big:{color:ui.colors.primaryText,fontFamily:'CormorantGaramond_600SemiBold',fontSize:32},row:{flexDirection:'row',flexWrap:'wrap',gap:ui.spacing.xs,alignItems:'center',justifyContent:'space-between'},flag:{flexDirection:'row',gap:ui.spacing.sm,alignItems:'center',paddingVertical:ui.spacing.sm,borderTopWidth:1,borderTopColor:ui.colors.border},bold:{color:ui.colors.primaryText,fontFamily:'Manrope_700Bold'},token:{borderWidth:1,borderColor:ui.colors.softGold,borderRadius:ui.radius.control,padding:ui.spacing.sm,gap:ui.spacing.xs,backgroundColor:ui.colors.softGold}});
