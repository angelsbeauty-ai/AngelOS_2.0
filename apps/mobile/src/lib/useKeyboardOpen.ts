import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/** True while the software keyboard is shown. iOS uses the will-events so layout moves with the keyboard. */
export function useKeyboardOpen(onShow?: () => void) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const a = Keyboard.addListener(showEvt, () => { setOpen(true); onShow?.(); });
    const b = Keyboard.addListener(hideEvt, () => setOpen(false));
    return () => { a.remove(); b.remove(); };
  }, [onShow]);
  return open;
}
