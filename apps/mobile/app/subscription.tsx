import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { dialog } from '../src/lib/dialog';
import { Screen } from '../src/components/Screen';
import { BodyText, Card, Pill, PrimaryActionLabel, ScreenTitle, SecondaryActionLabel, SectionTitle, SupportText, ui } from '../src/components/ui';
import { cancelSubscription, getSubscription, requestCheckout, type SubscriptionStatus } from '../src/lib/subscription';
import { getActiveWorkspace } from '../src/lib/workspace';

export default function SubscriptionScreen() {
  const { t } = useTranslation();
  const [workspaceId,setWorkspaceId]=useState<string|null>(null); const [status,setStatus]=useState<SubscriptionStatus|null>(null); const [interval,setInterval]=useState<'monthly'|'yearly'>('monthly'); const [busy,setBusy]=useState(false); const [loadFailed,setLoadFailed]=useState(false);
  useEffect(()=>{void load();},[]);
  async function load(){try{const workspace=await getActiveWorkspace();setWorkspaceId(workspace.id);const data=await getSubscription(workspace.id);setStatus(data);setInterval(data.subscription.billing_interval);}catch{setLoadFailed(true);}}
  async function checkout(){if(!workspaceId)return;setBusy(true);try{const result=await requestCheckout(workspaceId,interval);if(result.checkout.mode==='not_configured')void dialog.notify('Payment setup coming next',result.checkout.message);else void dialog.notify('Checkout ready','Open the secure payment checkout.');}catch(error){void dialog.notify('Could not start checkout',error instanceof Error?error.message:'Unknown error');}finally{setBusy(false);}}
  async function cancel(){if(!workspaceId)return;const ok=await dialog.confirm({title:'Cancel AngelOS?',message:'Your workspace will switch to read-only for 60 days. You can view, export or reactivate during that period.',cancelText:'Keep subscription',confirmText:t('sub.s11'),destructive:true});if(!ok)return;try{await cancelSubscription(workspaceId);await load();}catch(error){void dialog.notify('Could not cancel',error instanceof Error?error.message:'Unknown error');}}
  if(!status)return <Screen>
    <ScreenTitle>{t('nav2.subscription')}</ScreenTitle>
    <SupportText>{loadFailed ? 'Your plan could not be loaded just now. AngelOS is free while it is in private testing, and nothing is charged.' : t('sub.s4')}</SupportText>
    <BetaCard/>
  </Screen>;
  const paid=status.billingProvider.configured;
  const price=interval==='yearly'?status.plan.yearly_price_cents:status.plan.monthly_price_cents; const final=Math.round(price*(100-status.subscription.discount_percent)/100); const active=!['read_only','expired'].includes(status.subscription.status);
  return <Screen>
    <ScreenTitle>{t('nav2.subscription')}</ScreenTitle><SupportText>{t('sub.s4')}</SupportText>
    <Card premium><View style={styles.statusHeader}><View style={styles.statusCopy}><SupportText>{t('sub.s5')}</SupportText><Text style={styles.status}>{humanize(status.subscription.status)}</Text></View><Pill tone={active?'success':'warning'}>{active?'Full access':'Protected access'}</Pill></View><BodyText>{status.access.reason??'Full business access is available.'}</BodyText>{status.subscription.trial_ends_at&&status.subscription.status==='trialing'?<SupportText>Trial ends {new Date(status.subscription.trial_ends_at).toLocaleDateString()}</SupportText>:null}{status.subscription.read_only_until?<SupportText>Read-only access until {new Date(status.subscription.read_only_until).toLocaleDateString()}</SupportText>:null}</Card>
    {!paid?<BetaCard/>:<Card><SectionTitle>{t('sub.s6')}</SectionTitle><View style={styles.segmentRow}>{(['monthly','yearly'] as const).map((value)=><Pressable key={value} onPress={()=>setInterval(value)} style={[styles.segment,interval===value&&styles.selected]}><Text style={styles.segmentText}>{value==='monthly'?'Monthly':'Yearly'}</Text></Pressable>)}</View><Text style={styles.price}>{money(final,status.plan.currency)}<Text style={styles.priceUnit}>{interval==='monthly'?'/month':'/year'}</Text></Text>{status.subscription.discount_percent?<Pill tone="success">{status.subscription.discount_percent}% discount applied</Pill>:null}<Pressable disabled={busy} onPress={()=>void checkout()}><PrimaryActionLabel>{busy?'Working...':status.subscription.status==='active'?'Manage Plan':'Upgrade or Reactivate'}</PrimaryActionLabel></Pressable></Card>}
    <Card premium><SectionTitle>{t('sub.s9')}</SectionTitle><BodyText>{t('sub.s10')}</BodyText></Card>
    {active&&paid?<Pressable onPress={()=>void cancel()} disabled={busy}><Text style={styles.danger}>{t('sub.s11')}</Text></Pressable>:null}
  </Screen>;
}
function BetaCard(){ const { t } = useTranslation(); return <Card premium><SectionTitle>{t('sub.s12')}</SectionTitle><BodyText>{t('sub.s13')}</BodyText><SupportText>{t('sub.s14')}</SupportText></Card>; }
function money(cents:number,currency:string){return new Intl.NumberFormat('en-US',{style:'currency',currency}).format(cents/100)} function humanize(value:string){return value.replaceAll('_',' ').replace(/\b\w/g,(c)=>c.toUpperCase())}
const styles=StyleSheet.create({statusHeader:{flexDirection:'row',alignItems:'flex-start',gap:ui.spacing.sm},statusCopy:{flex:1,gap:2},status:{color:ui.colors.primaryText,fontSize:27,fontWeight:'700'},segmentRow:{flexDirection:'row',gap:ui.spacing.xs},segment:{flex:1,borderWidth:1,borderColor:ui.colors.border,borderRadius:ui.radius.control,padding:12,alignItems:'center',backgroundColor:ui.colors.elevated},selected:{borderColor:ui.colors.gold,backgroundColor:ui.colors.softGold},segmentText:{color:ui.colors.primaryText,fontSize:15,fontWeight:'700'},price:{color:ui.colors.primaryText,fontSize:30,fontWeight:'700'},priceUnit:{color:ui.colors.secondaryText,fontSize:15,fontWeight:'400'},danger:{color:ui.colors.critical,fontSize:15,fontWeight:'700',textAlign:'center',paddingVertical:ui.spacing.sm}});
