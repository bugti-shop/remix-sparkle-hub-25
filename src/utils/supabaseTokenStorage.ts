/**
 * Supabase-based refresh token storage.
 * Stores Google refresh tokens in the `user_refresh_tokens` table
 * so they survive app data clears and work across devices.
 */

import { supabase } from '@/lib/supabase';

/**
 * Save the Google refresh token to Supabase.
 * Requires the user to be authenticated with Supabase (via signInWithIdToken or OAuth).
 */
export const saveRefreshTokenToSupabase = async (
  refreshToken: string,
  _email?: string,
): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.warn('Cannot save refresh token — no Supabase user');
    return;
  }

  console.log(`[TokenDB] Saving refresh token for user ${user.id.slice(0, 8)}… (token length: ${refreshToken.length})`);

  const { error } = await supabase
    .from('user_refresh_tokens')
    .upsert(
      {
        user_id: user.id,
        google_refresh_token: refreshToken,
      },
      { onConflict: 'user_id' },
    );

  if (error) {
    console.error('[TokenDB] ❌ SAVE FAILED:', error.message, error.details, error.hint);
  } else {
    console.log('[TokenDB] ✅ Refresh token SAVED to Supabase DB');
    // Verification: read it back immediately to confirm it persisted
    try {
      const { data: verify, error: verifyErr } = await supabase
        .from('user_refresh_tokens')
        .select('google_refresh_token')
        .eq('user_id', user.id)
        .maybeSingle();

      if (verifyErr) {
        console.error('[TokenDB] ❌ VERIFY READ FAILED:', verifyErr.message);
      } else if (verify?.google_refresh_token) {
        console.log(`[TokenDB] ✅ VERIFIED: token exists in DB (length: ${verify.google_refresh_token.length})`);
      } else {
        console.error('[TokenDB] ❌ VERIFY FAILED: token NOT found after save!');
      }
    } catch (e) {
      console.warn('[TokenDB] Verify read-back error:', e);
    }
  }
};

/**
 * Load the Google refresh token from Supabase.
 * Used when local storage is cleared or on a new device.
 */
export const loadRefreshTokenFromSupabase = async (): Promise<string | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.warn('[TokenDB] Cannot load refresh token — no Supabase user');
    return null;
  }

  console.log(`[TokenDB] Loading refresh token for user ${user.id.slice(0, 8)}…`);

  const { data, error } = await supabase
    .from('user_refresh_tokens')
    .select('google_refresh_token')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('[TokenDB] ❌ LOAD FAILED:', error.message, error.details, error.hint);
    return null;
  }

  const token = data?.google_refresh_token || null;
  console.log(`[TokenDB] ${token ? '✅ Token LOADED from DB (length: ' + token.length + ')' : '⚠️ No token found in DB'}`);
  return token;
};
