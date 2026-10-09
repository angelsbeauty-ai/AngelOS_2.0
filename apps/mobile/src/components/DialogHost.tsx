import React, { useState, useCallback } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { tokens } from '../design/theme';

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
  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => handleResolve(false)}>
      <Pressable style={styles.backdrop} onPress={() => isConfirm && handleResolve(false)} accessibilityRole="none">
        <View style={styles.center}>
          <Pressable style={[styles.dialog, Platform.OS === 'web' ? webGlass : null]} onPress={(e) => e.stopPropagation()} accessibilityRole="alert">
            <Text maxFontSizeMultiplier={1.3} style={styles.title}>{current.title}</Text>
            {current.message ? <Text maxFontSizeMultiplier={1.3} style={styles.message}>{current.message}</Text> : null}
            <View style={styles.buttons}>
              {isConfirm && (
                <Pressable
                  style={[styles.button, styles.cancelButton]}
                  onPress={() => handleResolve(false)}
                  accessibilityRole="button"
                  accessibilityLabel={current.cancelText || 'Cancel'}
                >
                  <Text maxFontSizeMultiplier={1.3} style={styles.cancelText}>{current.cancelText || 'Cancel'}</Text>
                </Pressable>
              )}
              <Pressable
                style={[styles.button, styles.primaryButton, current.destructive && styles.destructiveButton]}
                onPress={() => handleResolve(true)}
                accessibilityRole="button"
                accessibilityLabel={current.confirmText || 'OK'}
              >
                <Text maxFontSizeMultiplier={1.3} style={[styles.buttonText, current.destructive && styles.destructiveText]}>
                  {current.confirmText || 'OK'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const webGlass = { backdropFilter: 'blur(20px) saturate(1.4)' } as unknown as object;

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
