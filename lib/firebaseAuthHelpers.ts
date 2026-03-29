/**
 * signInWithFirebaseCustomToken
 *
 * Fetches a Firebase custom auth token from /api/auth/custom-token for the
 * given userId and signs the client into Firebase Auth using it. This makes
 * request.auth.uid === userId for all subsequent Firestore operations, which
 * is required for the production Firestore security rules to work.
 *
 * IMPORTANT: this function is fire-and-forget safe. It is always wrapped in a
 * try/catch by the caller. If it fails, the caller's cookie-based session
 * continues to work and the user is NOT blocked from logging in.
 */
export async function signInWithFirebaseCustomToken(userId: string): Promise<void> {
  // Fetch the custom token from our server-side API route
  const tokenResponse = await fetch("/api/auth/custom-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });

  if (!tokenResponse.ok) {
    const errorBody = await tokenResponse.text();
    throw new Error(`Custom token API returned ${tokenResponse.status}: ${errorBody}`);
  }

  const { token, error } = await tokenResponse.json();

  if (error || !token) {
    throw new Error(`Custom token API error: ${error ?? "no token returned"}`);
  }

  // Dynamically import Firebase Auth to avoid adding it to the initial bundle
  const { getAuth, signInWithCustomToken } = await import("firebase/auth");
  const firebaseAuth = getAuth();

  await signInWithCustomToken(firebaseAuth, token);

  console.log("[Firebase Auth] Signed in successfully. UID:", userId);
}
