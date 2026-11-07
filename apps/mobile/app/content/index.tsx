import { Redirect } from 'expo-router';

/** Content is compose/edit/drafts; published posts have one home in Analytics. */
export default function ContentDraftsRedirect() {
  return <Redirect href={{ pathname: '/analytics', params: { pane: 'profile', filter: 'drafts' } }} />;
}
