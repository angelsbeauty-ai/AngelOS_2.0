import { Redirect, useLocalSearchParams } from 'expo-router';

/** Legacy links and composer previews converge on the one feed. */
export default function ContentGridRedirect() {
  const params = useLocalSearchParams();
  return <Redirect href={{ pathname: '/analytics', params: { ...params, pane: 'profile' } }} />;
}
