# Conversation layout — 20 Oct 2026

Goal: normal chat box like Instagram or Messenger.

## Target layout

- Header: back, avatar, name, platform
- Scroll: only message bubbles + day labels
- Bottom: ChatBar (text input + send)
- Tools (AI draft, notes, paste inbound, mark done, archive) in ChatTools sheet

## Ready

- ChatBar (apps/mobile/src/components/ChatBar.tsx)
- ChatTools (apps/mobile/src/components/ChatTools.tsx)
- NightMenu for bubble actions
- Banner follows Night

## Next

Wire ChatBar + ChatTools into messages/[id].tsx and rebuild.
