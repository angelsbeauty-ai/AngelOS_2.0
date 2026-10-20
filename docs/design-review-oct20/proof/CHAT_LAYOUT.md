# Conversation layout — 20 Oct 2026

Goal: normal chat box like Instagram or Messenger.

## Target layout

- Header: back, avatar, name, platform
- Scroll: only message bubbles + day labels
- Bottom: ChatBar (text input + send)
- Tools (AI draft, notes, paste inbound, mark done, archive) behind a tools menu, not stacked cards

## Done

- ChatBar component created (apps/mobile/src/components/ChatBar.tsx)
- NightMenu for bubble actions
- Banner follows Night

## Next

- Wire ChatBar into messages/[id].tsx
- Move the three Cards (paste, AI draft, private notes) out of the main scroll into a tools sheet
- Keep approve-before-send, but trigger it from the send button
- Rebuild and confirm on device
