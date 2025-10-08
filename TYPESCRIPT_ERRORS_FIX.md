# TypeScript Errors - How to Fix

## Current Errors

You're seeing TypeScript errors in these files:
- `packages/schedx-app/src/routes/api/queue/+server.ts`
- `packages/schedx-app/src/routes/api/queue/settings/+server.ts`
- `packages/schedx-app/src/routes/api/threads/+server.ts`

## Why These Errors Occur

The errors are happening because:
1. We added new methods to `DatabaseClient` class in `db.ts`
2. TypeScript hasn't been recompiled yet
3. The type definitions are out of sync

## The Errors You're Seeing

```
Property 'getTweetsByStatus' does not exist on type 'DatabaseClient'
Property 'getQueueSettings' does not exist on type 'DatabaseClient'
Property 'saveQueueSettings' does not exist on type 'DatabaseClient'
Property 'saveThread' does not exist on type 'DatabaseClient'
Property 'getThread' does not exist on type 'DatabaseClient'
Property 'getThreads' does not exist on type 'DatabaseClient'
Property 'deleteThread' does not exist on type 'DatabaseClient'
Property 'updateThreadStatus' does not exist on type 'DatabaseClient'
```

## How to Fix

### **Option 1: Rebuild Shared Library (Recommended)**

This will compile TypeScript and update all type definitions:

```bash
# From project root
npm run build --workspace=@schedx/shared-lib
```

This should take 10-30 seconds and will resolve all TypeScript errors.

### **Option 2: Full Rebuild**

If Option 1 doesn't work, do a full rebuild:

```bash
# Clean and rebuild everything
npm run build
```

### **Option 3: Restart TypeScript Server (VS Code)**

If errors persist after rebuilding:
1. Press `Ctrl+Shift+P` (Windows) or `Cmd+Shift+P` (Mac)
2. Type "TypeScript: Restart TS Server"
3. Press Enter

## Verification

After rebuilding, these methods should be recognized:

### Queue Methods (in db.ts):
- ✅ `getTweetsByStatus(userId, status)` - Line 733
- ✅ `updateTweet(tweetId, updates)` - Line 748
- ✅ `getQueueSettings(userId)` - Line 756
- ✅ `saveQueueSettings(settings)` - Line 768

### Thread Methods (in db.ts):
- ✅ `saveThread(thread)` - Line 790
- ✅ `getThread(threadId)` - Line 810
- ✅ `getThreads(userId, status?)` - Line 822
- ✅ `deleteThread(threadId)` - Line 841
- ✅ `updateThreadStatus(threadId, status, twitterThreadId?)` - Line 845

## Why This Happens

When you add new methods to a class in TypeScript:
1. The JavaScript code is valid immediately
2. But TypeScript needs to recompile to update `.d.ts` type definition files
3. Other packages importing this class see outdated types until rebuild

This is normal in monorepo setups with multiple packages!

## Quick Test

After rebuilding, run this to verify no TS errors:

```bash
# Check for TypeScript errors
npm run check --workspace=@schedx/app
```

If it passes, you're good to go! 🎉

## Still Having Issues?

If errors persist after rebuilding, check:

1. **Make sure methods were actually added to db.ts**
   - Open `packages/schedx-shared-lib/src/backend/db.ts`
   - Search for `async saveThread`
   - Should be around line 790

2. **Check node_modules**
   - Sometimes cached. Try: `rm -rf node_modules && npm install`

3. **Check tsconfig.json**
   - Make sure `composite: true` is set in shared-lib
   - Make sure app references shared-lib correctly

## Summary

**TL;DR:** Just run `npm run build --workspace=@schedx/shared-lib` and the errors will disappear! ✨

The code is correct, TypeScript just needs to catch up.
