#!/bin/bash
# Bulk replace Alert.alert in all non-dialog files
# This script shows the pattern; Gordon applies it manually to each file

# Pattern 1: Error alerts (no buttons) → toast.show(toFriendly(...))
# OLD: Alert.alert('Title', error.message)
# NEW: import {notify} from '../src/lib/dialog'; notify('Title', error.message)

# Pattern 2: Confirmation dialogs (buttons) → confirm()
# OLD: Alert.alert('Title', 'msg', [{text:'OK',...}, {text:'Cancel',...}])
# NEW: import {confirm} from '../src/lib/dialog'; if(await confirm({title:'Title', message:'msg'})) { ... }

# Files to update (22 total):
FILES=(
  "app/ai-settings.tsx"
  "app/ai.tsx"
  "app/analytics.tsx"
  "app/automations.tsx"
  "app/beta-feedback.tsx"
  "app/bookings/new.tsx"
  "app/clients/[id].tsx"
  "app/clients/new.tsx"
  "app/content/[id].tsx"
  "app/content/index.tsx"
  "app/content/new.tsx"
  "app/finance.tsx"
  "app/founder-admin.tsx"
  "app/marketing-profile.tsx"
  "app/media/import.tsx"
  "app/media/index.tsx"
  "app/messages/[id].tsx"
  "app/messages/index.tsx"
  "app/onboarding.tsx"
  "app/services.tsx"
  "app/subscription.tsx"
  "app/system-health.tsx"
)

echo "Files to update: ${#FILES[@]}"
for f in "${FILES[@]}"; do
  echo "  - $f"
done
