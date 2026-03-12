---
name: Bug report
about: Create a report to help us improve AIOX-FullStack
title: '[BUG] '
labels: ['bug', 'needs-triage']
assignees: ''

---

## 🐛 Bug Description
A clear and concise description of what the bug is.

## 📦 Package Information
Which AIOX-FullStack package is affected?
- [ ] @synkra/aiox-core/workspace
- [ ] @synkra/aiox-core/core
- [ ] @synkra/aiox-core/memory
- [ ] @synkra/aiox-core/security
- [ ] @synkra/aiox-core/performance
- [ ] @synkra/aiox-core/telemetry

**Version:** (e.g., 4.31.0)

## 🔄 Steps to Reproduce
Steps to reproduce the behavior:
1. Install package '...'
2. Run command '...'
3. Call function '...'
4. See error

## 💥 Expected Behavior
A clear and concise description of what you expected to happen.

## 📱 Actual Behavior
A clear and concise description of what actually happened.

## 📋 Code Example
```javascript
// Minimal code example that reproduces the issue
const { AIOX } = require('@synkra/aiox-core/workspace');

const aios = new AIOX();
// ... rest of your code
```

## 📄 Error Output
```
Paste any error messages or stack traces here
```

## 🖥️ Environment
**System Information:**
- OS: [e.g., Windows 11, Ubuntu 22.04, macOS 14]
- Node.js version: [e.g., 20.11.0]
- NPM version: [e.g., 10.2.4]
- Package manager: [npm/yarn/pnpm]

**AIOX Configuration:**
```javascript
// Your AIOX configuration (remove sensitive data)
const config = {
  // ...
};
```

## 📊 Health Check Output
If possible, run `aios.healthCheck()` and paste the output:
```javascript
// Health check results
```

## 🔍 Additional Context
Add any other context about the problem here.

## 🎯 Priority
How critical is this bug for your use case?
- [ ] Critical - Blocking production use
- [ ] High - Significant impact on functionality
- [ ] Medium - Minor impact, workaround available
- [ ] Low - Enhancement or nice-to-have fix

## ✅ Checklist
- [ ] I have searched existing issues to avoid duplicates
- [ ] I have provided all requested information
- [ ] I have tested with the latest version
- [ ] I can consistently reproduce this issue
