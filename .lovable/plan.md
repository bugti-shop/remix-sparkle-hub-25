

## Plan: Bulletproof Token Persistence + 24/7 Drive Sync

### Summary
Firestore rules are set ✅. Now we wire in automatic token recovery from Firestore and ensure the 5-minute sync loop always refreshes the token before syncing — so Drive sync works indefinitely without any redirect.

### What Changes

**1. `src/utils/googleAuth.ts` — Add Firestore token recovery to `getValidAccessToken()`**

When no local user is found (app data cleared, new device), attempt to load session from Firestore before giving up. This prevents the user from being forced to sign in again.

```
getValidAccessToken():
  1. Check local storage → if found & fresh, return token
  2. NEW: If no local user, try loadSessionFromFirebase() → restore to local storage
  3. If token expired, refresh silently (GIS/native) with retries
  4. Backup refreshed token to Firestore
```

**2. `src/utils/googleDriveSync.ts` — Add token refresh before every sync cycle**

The 5-minute auto-sync interval should call `backgroundTokenRefresh()` before `syncWithDrive()` to ensure the token is always fresh when Drive API calls are made.

```
autoSyncInterval = setInterval(async () => {
  if (!navigator.onLine) return;
  await backgroundTokenRefresh();  // ← NEW: refresh token first
  syncWithDrive().catch(() => {});
}, AUTO_SYNC_INTERVAL);
```

**3. `src/utils/tokenStorage.ts` — No changes needed**

Already has `saveSessionToFirebase()` and `loadSessionFromFirebase()` — both work correctly with the Firestore rules you added.

### Technical Details

- `loadSessionFromFirebase()` requires an active Firebase Auth user (`firebaseAuth.currentUser`). Firebase Auth persists via IndexedDB, so it survives app restarts even when localStorage/settings are cleared.
- Token recovery flow: Firebase Auth (IndexedDB) → get UID → Firestore `user_tokens/{uid}` → restore `GoogleUser` to local settings → use access token for Drive sync.
- If the recovered Firestore token is also expired (>1 hour old), the normal silent refresh (GIS/native) kicks in automatically — no redirect.

### What YOU already did
- ✅ Added Firestore security rules for `user_tokens/{userId}`

### Result
- User signs in with Google **once**
- Token refreshes silently every ~45 minutes
- Sync runs every 5 minutes, 24/7
- If app data is cleared, session recovers from Firestore automatically
- **Zero redirects to accounts.google.com** after initial login

