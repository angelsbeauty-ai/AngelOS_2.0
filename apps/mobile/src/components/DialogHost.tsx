import i18n from '../i18n';
import React, { useState, useCallback } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { tokens } from '../design/theme';
import { useAppearance } from '../design/appearance';
import { humanMessage } from '../design/night-web';

type DialogRequest = {
  id: string;
  type: 'notify' | 'confirm';
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  resolve: (value: boolean) => void;
};

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
};

// Module-level queue shared by notify()/confirm() and the single mounted host.
let queue: DialogRequest[] = [];
let listener: ((q: DialogRequest[]) => void) | null = null;
let nextId = 0;

function publish() {
  listener?.(queue);
}

function enqueue(request: Omit<DialogRequest, 'id'>) {
  if (!listener) throw new Error('DialogHost is not mounted');
  queue = [...queue, { ...request, id: String(++nextId) }];
  publish();
}

export function DialogHost() {
  const [items, setItems] = useState<DialogRequest[]>(queue);

  React.useEffect(() => {
    listener = setItems;
    setItems(queue);
    return () => {
      if (listener === setItems) listener = null;
    };
  }, []);

  const current = items[0];
  const handleResolve = useCallback((value: boolean) => {
    if (!current) return;
    queue = queue.filter((item) => item.id !== current.id);
    publish();
    current.resolve(value);
  }, [current]);

  if (!current) return null;

  const isConfirm = current.type === 'confirm';
  const message = humanMessage(current.message);
  return <ThemedDialog current={current} isConfirm={isConfirm} message={message} onResolve={handleResolve} />;
}

function ThemedDialog({ current, isConfirm, message, onResolve }: { current: DialogRequest; isConfirm: boolean; message?: string; onResolve: (v: boolean) => void }) {
  const { mode } = useAppearance();
  const night = mode === 'night';
  const card = night ? '#161618' : tokens.color.ivorySolid;
  const text = night ? '#F4F4F5' : tokens.color.charcoal;
  const secondary = night ? '#C7C7CC' : tokens.color.charcoal2;
  const border = night ? 'rgba(255,255,255,0.14)' : tokens.color.hairline;
  const primaryBg = night ? '#F4F4F5' : tokens.color.charcoal;
  const primaryFg = night ? '#151515' : '#FFFFFF';
  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => onResolve(false)}>
      <Pressable style={[styles.backdrop, night && { backgroundColor: 'rgba(0,0,0,0.62)' }]} onPress={() => isConfirm && onResolve(false)} accessibilityRole="none">
        <View style={styles.center}>
          <Pressable style={[styles.dialog, { backgroundColor: card, borderWidth: 1, borderColor: border, borderRadius: 20 }, Platform.OS === 'web' ? webGlass : null]} onPress={(e) => e.stopPropagation()} accessibilityRole="alert">
            <Text style={[styles.title, { color: text }]}>{current.title}</Text>
            {message ? <Text style={[styles.message, { color: secondary }]}>{message}</Text> : null}
            <View style={styles.buttons}>
              {isConfirm && (
                <Pressable
                  style={[styles.button, { backgroundColor: 'transparent', borderWidth: 1, borderColor: border }]}
                  onPress={() => onResolve(false)}
                  accessibilityRole="button"
                  accessibilityLabel={current.cancelText || i18n.t('dialog.cancel')}
                >
                  <Text style={[styles.cancelText, { color: text }]}>{current.cancelText || i18n.t('dialog.cancel')}</Text>
                </Pressable>
              )}
              <Pressable
                style={[styles.button, { backgroundColor: current.destructive ? tokens.color.coral : primaryBg }]}
                onPress={() => onResolve(true)}
                accessibilityRole="button"
                accessibilityLabel={current.confirmText || i18n.t('dialog.ok')}
              >
                <Text style={[styles.buttonText, { color: current.destructive ? '#FFFFFF' : primaryFg }]}>
                  {current.confirmText || i18n.t('dialog.ok')}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const webGlass = {} as object;

/** Throws if no DialogHost is mounted so callers (src/lib/dialog.ts) can fall back. */
export function notify(title: string, message?: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    try {
      enqueue({ type: 'notify', title, message, resolve: () => resolve() });
    } catch (error) {
      reject(error);
    }
  });
}

/** Throws if no DialogHost is mounted so callers (src/lib/dialog.ts) can fall back. */
export function confirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise<boolean>((resolve, reject) => {
    try {
      enqueue({ type: 'confirm', ...options, resolve });
    } catch (error) {
      reject(error);
    }
  });
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(30, 33, 34, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  dialog: {
    backgroundColor: tokens.color.ivorySolid,
    borderRadius: tokens.radius.card,
    padding: 24,
    maxWidth: 320,
    width: '90%',
    gap: 16,
  },
  title: {
    color: tokens.color.charcoal,
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 22,
  },
  message: {
    color: tokens.color.charcoal2,
    fontSize: 15,
    lineHeight: 20,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: tokens.radius.block,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  cancelButton: {
    backgroundColor: tokens.color.ivory,
    borderWidth: 1,
    borderColor: tokens.color.hairline,
  },
  cancelText: {
    color: tokens.color.charcoal2,
    fontSize: 15,
    fontWeight: '600',
  },
  destructiveButton: {
    backgroundColor: tokens.color.coral,
  },
  primaryButton: {
    backgroundColor: tokens.color.charcoal,
  },
  buttonText: {
    color: tokens.color.onCharcoal,
    fontSize: 15,
    fontWeight: '600',
  },
  destructiveText: {
    color: tokens.color.onCharcoal,
  },
});
