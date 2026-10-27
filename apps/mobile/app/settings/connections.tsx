import { Redirect } from 'expo-router';

/** One Accounts screen in V1: the old Connections list now opens Accounts (LINE, Instagram, Facebook). */
export default function ConnectionsScreen() {
  return <Redirect href={'/content/accounts' as any} />;
}
