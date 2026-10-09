import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View, Pressable } from 'react-native';
import { Link } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { BodyText, Card, Pill, PrimaryActionLabel, ScreenTitle, SectionTitle, SupportText, ui } from '../../src/components/ui';

type Language = 'en' | 'ja';
type Platform = 'instagram_feed' | 'instagram_reel' | 'facebook' | 'line' | 'tiktok';

export default function NewPostScreen() {
  const [goal, setGoal] = useState<string>('');
  const [language, setLanguage] = useState<Language>('en');
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(['instagram_feed']);
  const [mediaIds, setMediaIds] = useState<string[]>([]);
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [scheduledFor, setScheduledFor] = useState('');
  const [busy, setBusy] = useState(false);

  const platforms: { id: Platform; label: string }[] = [
    { id: 'instagram_feed', label: 'IG Feed' },
    { id: 'instagram_reel', label: 'IG Reel' },
    { id: 'facebook', label: 'Facebook' },
    { id: 'line', label: 'LINE Broadcast' },
    { id: 'tiktok', label: 'TikTok' },
  ];

  const goals = ['Bookings', 'Academy students', 'Trust & credibility', 'Reach', 'Engagement'];

  const togglePlatform = (p: Platform) => {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  async function save() {
    if (!goal || !caption.trim()) return;
    setBusy(true);
    try {
      // TODO: Call API to create draft(s)
      // For now, just show success
      alert('Post draft created');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <ScreenTitle>Create Post</ScreenTitle>
      <SupportText>Write your caption with AngelOS AI suggestions. Choose which platforms to post on.</SupportText>

      <Card>
        <SectionTitle>Goal</SectionTitle>
        <View style={styles.goalGrid}>
          {goals.map((g) => (
            <Pressable
              key={g}
              style={[styles.goalPill, goal === g && styles.goalPillSelected]}
              onPress={() => setGoal(g)}
            >
              <Text style={[styles.goalPillText, goal === g && styles.goalPillTextSelected]}>
                {g}
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card>
        <SectionTitle>Language</SectionTitle>
        <View style={styles.languageToggle}>
          <Pressable
            style={[styles.langButton, language === 'en' && styles.langButtonActive]}
            onPress={() => setLanguage('en')}
          >
            <Text style={[styles.langButtonText, language === 'en' && styles.langButtonTextActive]}>
              English
            </Text>
          </Pressable>
          <Pressable
            style={[styles.langButton, language === 'ja' && styles.langButtonActive]}
            onPress={() => setLanguage('ja')}
          >
            <Text style={[styles.langButtonText, language === 'ja' && styles.langButtonTextActive]}>
              日本語
            </Text>
          </Pressable>
        </View>
      </Card>

      <Card>
        <SectionTitle>Caption</SectionTitle>
        <TextInput
          value={caption}
          onChangeText={setCaption}
          placeholder="Write your caption here..."
          placeholderTextColor={ui.colors.secondaryText}
          multiline
          style={styles.captionInput}
        />
        <SupportText>{caption.length} characters</SupportText>
        <View style={styles.buttonRow}>
          <Pressable style={styles.actionButton}>
            <Text style={styles.actionButtonText}>Shorter</Text>
          </Pressable>
          <Pressable style={styles.actionButton}>
            <Text style={styles.actionButtonText}>Warmer</Text>
          </Pressable>
          <Pressable style={styles.actionButton}>
            <Text style={styles.actionButtonText}>Pro</Text>
          </Pressable>
        </View>
      </Card>

      <Card>
        <SectionTitle>Platforms</SectionTitle>
        <View style={styles.platformGrid}>
          {platforms.map((p) => (
            <Pressable
              key={p.id}
              style={[styles.platformButton, selectedPlatforms.includes(p.id) && styles.platformButtonSelected]}
              onPress={() => togglePlatform(p.id)}
            >
              <Text
                style={[
                  styles.platformButtonText,
                  selectedPlatforms.includes(p.id) && styles.platformButtonTextSelected,
                ]}
              >
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card>
        <SectionTitle>Hashtags</SectionTitle>
        <TextInput
          value={hashtags}
          onChangeText={setHashtags}
          placeholder="#hashtags #separated"
          placeholderTextColor={ui.colors.secondaryText}
          style={styles.input}
        />
      </Card>

      <Card>
        <SectionTitle>Schedule (Optional)</SectionTitle>
        <TextInput
          value={scheduledFor}
          onChangeText={setScheduledFor}
          placeholder="2026-10-15T19:00"
          placeholderTextColor={ui.colors.secondaryText}
          style={styles.input}
        />
        <SupportText>Leave blank to save as draft</SupportText>
      </Card>

      <View style={styles.actions}>
        <Pressable disabled={busy} onPress={save} style={styles.saveButton}>
          <PrimaryActionLabel>{busy ? 'Saving...' : 'Save Draft'}</PrimaryActionLabel>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  goalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing.sm,
    marginVertical: ui.spacing.sm,
  },
  goalPill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: ui.colors.elevated,
    borderWidth: 1,
    borderColor: ui.colors.hairline,
  },
  goalPillSelected: {
    backgroundColor: ui.colors.gold,
    borderColor: ui.colors.gold,
  },
  goalPillText: {
    color: ui.colors.primaryText,
    fontSize: 14,
    fontWeight: '500',
  },
  goalPillTextSelected: {
    color: ui.colors.onCharcoal,
    fontWeight: '600',
  },
  languageToggle: {
    flexDirection: 'row',
    gap: ui.spacing.sm,
    marginVertical: ui.spacing.sm,
  },
  langButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: ui.spacing.sm,
    borderRadius: ui.radius.control,
    backgroundColor: ui.colors.elevated,
    borderWidth: 1,
    borderColor: ui.colors.hairline,
    alignItems: 'center',
  },
  langButtonActive: {
    backgroundColor: ui.colors.gold,
    borderColor: ui.colors.gold,
  },
  langButtonText: {
    color: ui.colors.primaryText,
    fontSize: 14,
    fontWeight: '600',
  },
  langButtonTextActive: {
    color: ui.colors.onCharcoal,
  },
  captionInput: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: ui.colors.border,
    borderRadius: ui.radius.control,
    paddingHorizontal: ui.spacing.sm,
    paddingVertical: ui.spacing.sm,
    color: ui.colors.primaryText,
    fontSize: 16,
    textAlignVertical: 'top',
    marginVertical: ui.spacing.sm,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: ui.spacing.sm,
    marginVertical: ui.spacing.sm,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: ui.spacing.xs,
    borderRadius: ui.radius.control,
    backgroundColor: ui.colors.elevated,
    alignItems: 'center',
  },
  actionButtonText: {
    color: ui.colors.primaryText,
    fontSize: 13,
    fontWeight: '600',
  },
  platformGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing.sm,
    marginVertical: ui.spacing.sm,
  },
  platformButton: {
    flex: 0.48,
    paddingVertical: 10,
    borderRadius: ui.radius.control,
    backgroundColor: ui.colors.elevated,
    borderWidth: 1,
    borderColor: ui.colors.hairline,
    alignItems: 'center',
  },
  platformButtonSelected: {
    backgroundColor: ui.colors.gold,
    borderColor: ui.colors.gold,
  },
  platformButtonText: {
    color: ui.colors.primaryText,
    fontSize: 13,
    fontWeight: '600',
  },
  platformButtonTextSelected: {
    color: ui.colors.onCharcoal,
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: ui.colors.border,
    borderRadius: ui.radius.control,
    paddingHorizontal: ui.spacing.sm,
    color: ui.colors.primaryText,
    fontSize: 16,
    marginVertical: ui.spacing.sm,
  },
  actions: {
    gap: ui.spacing.sm,
    marginVertical: ui.spacing.md,
  },
  saveButton: {
    marginBottom: ui.spacing.xl,
  },
});
