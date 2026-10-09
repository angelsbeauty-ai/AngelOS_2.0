import React, { useState, useCallback } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { tokens, ui } from '../design/theme';

type DialogRequest = {
  id: string;
  type: 'notify' | 'confirm';
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  resolve: (value: boolean | void) => void;
};

let dialogQueue: DialogRequest[] = [];
let setQueue: ((q: DialogRequest[]) => void) | null = null;

export function DialogHost() {
  const [queue, _setQueue] = useState<DialogRequest[]>([]);
  
  React.useEffect(() => {
    setQueue(() => _setQueue);
  }, []);

  const current = queue[0];
  const handleResolve = useCallback((value: boolean | void) => {
    current?.resolve(value);
    _setQueue((q) => q.slice(1));
  }, [current]);

  if (!current) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => handleResolve(false)}>
      <Pressable style={styles.backdrop} onPress={() => current.type === 'confirm' && handleResolve(false)}>
        <View style={styles.center}>
          <Pressable style={styles.dialog} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.title}>{current.title}</Text>
            {current.message && <Text style={styles.message}>{current.message}</Text>}
            <View style={styles.buttons}>
              {current.type === 'confirm' && (
                <Pressable style={[styles.button, styles.cancelButton]} onPress={() => handleResolve(false)}>
                  <Text style={styles.cancelText}>{current.cancelText || 'Cancel'}</Text>
                </Pressable>
              )}
              <Pressable
                style={[styles.button, current.destructive && styles.destructiveButton]}
                onPress={() => handleResolve(current.type === 'notify' ? undefined : true)}
              >
                <Text style={[styles.buttonText, current.destructive && styles.destructiveText]}>
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

export async function notify(title: string, message: string): Promise<void> {
  if (Platform.OS === 'web') {
    return new Promise<void>((resolve) => {
      const id = Math.random().toString();
      const request: DialogRequest = { id, type: 'notify', title, message, resolve: () => resolve() };
      if (setQueue) {
        dialogQueue = [...dialogQueue, request];
        setQueue(dialogQueue);
      } else {
        window.alert(`${title}\n\n${message}`);
        resolve();
      }
    });
  }
  return new Promise<void>((resolve) => {
    const id = Math.random().toString();
    const request: DialogRequest = { id, type: 'notify', title, message, resolve: () => resolve() };
    dialogQueue = [...dialogQueue, request];
    if (setQueue) setQueue(dialogQueue);
  });
}

export async function confirm(options: {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}): Promise<boolean> {
  return new Promise((resolve) => {
    const id = Math.random().toString();
    const request: DialogRequest = {
      id,
      type: 'confirm',
      title: options.title,
      message: options.message,
      confirmText: options.confirmText,
      cancelText: options.cancelText,
      destructive: options.destructive,
      resolve,
    };
    dialogQueue = [...dialogQueue, request];
    if (setQueue) setQueue(dialogQueue);
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
    backgroundColor: tokens.color.ivory,
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
  buttonText: {
    color: tokens.color.charcoal,
    fontSize: 15,
    fontWeight: '600',
  },
  destructiveText: {
    color: tokens.color.onCharcoal,
  },
});
