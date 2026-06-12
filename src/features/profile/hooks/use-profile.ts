import { routes, type RouteItem } from '@/lib/demo-data';
import { useMemo } from 'react';

import { CURRENT_USER_ID, getProfileById, getProfilePosts } from '../data/profile-demo';
import type { Profile, ProfilePost } from '../types';

type UseProfileResult = {
  profile: Profile | undefined;
  posts: ProfilePost[];
  userRoutes: RouteItem[];
  isLoading: boolean;
  error: Error | null;
};

export function useProfile(userId?: string): UseProfileResult {
  // TODO: replace with API — e.g. useQuery(['profile', userId], () => profileService.get(userId))
  const profile = useMemo(
    () => getProfileById(userId ?? CURRENT_USER_ID),
    [userId],
  );

  const posts = useMemo(
    () => (profile ? getProfilePosts(profile.id) : []),
    [profile],
  );

  const userRoutes = useMemo(() => {
    if (!profile) return [];
    return profile.routeIds
      .map((id) => routes.find((route) => route.id === id))
      .filter(Boolean) as RouteItem[];
  }, [profile]);

  return {
    profile,
    posts,
    userRoutes,
    isLoading: false,
    error: null,
  };
}
