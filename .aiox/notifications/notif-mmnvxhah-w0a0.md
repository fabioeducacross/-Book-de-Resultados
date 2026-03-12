---
id: notif-mmnvxhah-w0a0
type: ids_health_warning
recipient: @dev
timestamp: 2026-03-12T19:52:53.705Z
status: sent
---

[IDS Self-Healing] WARNING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Issue: missing-file (CRITICAL)
Entity: deleted-task
Path: tasks/deleted.md

Problem: Referenced file does not exist on disk

Details:
  path: "tasks/deleted.md"

Suggested Actions:
  1. Check if file was moved: git log --follow --diff-filter=R -- "*deleted-task*"
  2. If intentionally deleted, remove from registry
  3. If accidentally deleted, restore from git: git checkout HEAD~1 -- tasks/deleted.md

This issue requires manual intervention and cannot be auto-fixed.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━