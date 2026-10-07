import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { GlassSurface } from './Glass';
import { motion, tokens } from '../design/theme';

type Toast = { title: string; message?: string; tone: 'success' | 'info' | 'error'; action?: { label: string; onPress: () => void } };
const ToastContext = createContext<{ show: (toast: Toast) => void }>({ show: () => {} });
export function ToastProvider({ children }: PropsWithChildren) { const [toast, setToast] = useState<Toast | null>(null); const show = (next: Toast) => { setToast(next); setTimeout(() => setToast(null), motion.toastMs); void AccessibilityInfo.announceForAccessibility(next.title); }; const value = useMemo(() => ({ show }), []); return <ToastContext.Provider value={value}>{children}{toast ? <View pointerEvents="box-none" style={styles.host}><GlassSurface kind="toast" style={styles.toast}><Text accessibilityLiveRegion="polite" style={styles.title}>{toast.title}</Text>{toast.message ? <Text style={styles.message}>{toast.message}</Text> : null}{toast.action ? <Pressable onPress={toast.action.onPress}><Text style={styles.action}>{toast.action.label}</Text></Pressable> : null}</GlassSurface></View> : null}</ToastContext.Provider>; }
export function useToast() { return useContext(ToastContext); }
const styles = StyleSheet.create({ host: { position: 'absolute', left: 20, right: 20, bottom: 24, zIndex: 20 }, toast: { borderRadius: 20, padding: 16, gap: 4 }, title: { color: tokens.color.charcoal, fontFamily: tokens.font.uiBold, fontSize: 15 }, message: { color: tokens.color.charcoal2, fontFamily: tokens.font.ui, fontSize: 14 }, action: { color: tokens.color.tide, fontFamily: tokens.font.uiBold, marginTop: 6 } });
void Animated;
