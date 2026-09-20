'use client';

import { getCurrentUser } from 'aws-amplify/auth';

export async function getWorkspaceId(): Promise<string> {
  if (typeof window === 'undefined') return 'legacy';

  try {
    const user = await getCurrentUser();
    return user.userId || user.username || 'legacy';
  } catch {
    return 'legacy';
  }
}