import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { Screen } from '../src/components/Screen';
import { ErrorState } from '../src/components/ErrorState';
import { BodyText, Card, Pill, PrimaryActionLabel, Row, ScreenTitle, SecondaryActionLabel, SectionTitle, SupportText, ui } from '../src/components/ui';
import { RowMenu } from '../src/components/RowMenu';
import { confirm } from '../src/lib/dialog';
import { cancelAppointment, confirmAppointment, getCalendar, type CalendarAppointment, type CalendarBlock } from '../src/lib/bookings';
import { getActiveWorkspace } from '../src/lib/workspace';
import { toFriendly, type FriendlyResult } from '../src/lib/friendly-error';

export default function CalendarScreen(){
  const {focusLabel}=useLocalSearchParams<{focusLabel?:string}>();
  const [appointments,setAppointments]=useState<CalendarAppointment[]>([]);
  const [blocks,setBlocks]=useState<CalendarBlock[]>([]);
  const [workspaceId,setWorkspaceId]=useState<string|null>(null);
  const [busy,setBusy]=useState(true);
  const [loadError,setLoadError]=useState<FriendlyResult|null>(null);
  
  useEffect(()=>{void load();},[]);
  
  async function load(){
    setBusy(true);
    setLoadError(null);
    try{
      const workspace=await getActiveWorkspace();
      setWorkspaceId(workspace.id);
      const start=startOfToday();
      const end=new Date(start.getTime()+7*24*60*60*1000);
      const data=await getCalendar(workspace.id,start.toISOString(),end.toISOString());
      setAppointments(data.appointments);
      setBlocks(data.blocks);
    }catch(error){
      setLoadError(toFriendly(error,{action:'load',thing:'calendar'}));
    }finally{
      setBusy(false);
    }
  }
  
  const items=[...appointments.map(item=>({id:`a-${item.id}`,start:item.start_at,kind:'appointment',title:`${item.client?.display_name??'Client'} | ${item.service_name}`,detail:item.status})),...blocks.map(item=>({id:`b-${item.id}`,start:item.start_at,kind:'block',title:item.title,detail:`${item.block_type} block`}))].sort((a,b)=>a.start.localeCompare(b.start));
  
  return <Screen><View style={styles.header}><View style={styles.headerCopy}><Pill tone="gold">Next 7 Days</Pill><ScreenTitle>Calendar</ScreenTitle><SupportText>Appointments, model blocks, classes and conflict checks.</SupportText></View><Link href="/bookings/new" asChild><Pressable style={styles.newBookingButton}><PrimaryActionLabel>New Booking</PrimaryActionLabel></Pressable></Link></View>{focusLabel?<Card premium><SectionTitle>Checking Availability</SectionTitle><BodyText>{focusLabel}</BodyText></Card>:null}<Card><Row><View><SectionTitle>Calendar Controls</SectionTitle><SupportText>Services control duration, buffers and price snapshots.</SupportText></View></Row><View style={styles.controlRow}><Link href="/services" style={styles.serviceLink}>Manage Services</Link><Pressable onPress={()=>void load()} style={styles.refreshButton}><SecondaryActionLabel>Refresh</SecondaryActionLabel></Pressable></View></Card>{busy?<Card><BodyText>Loading calendar...</BodyText></Card>:null}{!busy&&loadError?<ErrorState title={loadError.title} message={loadError.message} onRetry={()=>void load()}/>:null}{!busy&&!loadError&&items.length===0?<Card><SectionTitle>No bookings yet</SectionTitle><SupportText>No appointments or blocks in the next 7 days.</SupportText></Card>:null}<View style={styles.timeline}>{items.map(item=>item.kind==='appointment'?<RowMenu key={item.id} accessibilityHint="Hold for booking options" onPress={()=>{}} actions={[{id:'confirm',title:'Confirm',later:item.detail!=='request'&&item.detail!=='confirmation_pending'},{id:'reschedule',title:'Reschedule'},{id:'message',title:'Message'},{id:'markdone',title:'Mark done'},{id:'cancel',title:'Cancel',destructive:true}]} onAction={async(action)=>{const appointmentId=item.id.slice(2);if(action==='confirm'&&workspaceId)void confirmAppointment(workspaceId,appointmentId).then(()=>load());if(action==='reschedule'&&workspaceId)router.push({pathname:'/bookings/new',params:{clientId:item.id}});if(action==='markdone'&&workspaceId){/* TODO: implement mark done */}if(action==='cancel'&&workspaceId){const doCancel=await confirm({title:`Cancel ${item.title.split(' | ')[0]}'s appointment?`,message:'The slot opens up again.',confirmText:'Cancel appointment',destructive:true});if(doCancel)void cancelAppointment(workspaceId,appointmentId).then(()=>load());}}}><Card premium><View style={styles.itemHeader}><Pill tone="gold">appointment</Pill><SupportText>{formatCalendarTime(item.start)}</SupportText></View><Text style={styles.itemTitle}>{item.title}</Text><SupportText>{item.detail.replaceAll('_',' ')}</SupportText></Card></RowMenu>:<Card key={item.id}><View style={styles.itemHeader}><Pill tone="secondary">block</Pill><SupportText>{formatCalendarTime(item.start)}</SupportText></View><Text style={styles.itemTitle}>{item.title}</Text><SupportText>{item.detail.replaceAll('_',' ')}</SupportText></Card>)}</View></Screen>
}

function startOfToday(){const now=new Date();return new Date(now.getFullYear(),now.getMonth(),now.getDate());}
function formatCalendarTime(value:string){return new Date(value).toLocaleString(undefined,{weekday:'short',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});}

const styles=StyleSheet.create({header:{flexDirection:'row',alignItems:'flex-start',gap:ui.spacing.sm},headerCopy:{flex:1,gap:ui.spacing.xs},newBookingButton:{width:132},controlRow:{flexDirection:'row',alignItems:'center',gap:ui.spacing.sm},serviceLink:{flex:1,color:ui.colors.gold,fontSize:15,fontWeight:'700',paddingVertical:ui.spacing.sm},refreshButton:{width:104},timeline:{gap:ui.spacing.sm},itemHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:ui.spacing.sm},itemTitle:{color:ui.colors.primaryText,fontSize:17,fontWeight:'700'}});
