import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const GLOBAL_FOLLOW_STORAGE_KEY = 'ui.timeline.follow.enabled';
const LEGACY_FOLLOW_STORAGE_PREFIX = 'timeline-follow:';

function parseFollowValue(value: string | null): boolean | null {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

function readLegacyFollowFromStorage(runId: string | undefined): boolean | null {
  if (!runId) return null;
  const raw = window.localStorage.getItem(`${LEGACY_FOLLOW_STORAGE_PREFIX}${runId}`);
  return parseFollowValue(raw);
}

function readGlobalFollowFromStorage(): boolean | null {
  return parseFollowValue(window.localStorage.getItem(GLOBAL_FOLLOW_STORAGE_KEY));
}

function writeGlobalFollowToStorage(value: boolean) {
  window.localStorage.setItem(GLOBAL_FOLLOW_STORAGE_KEY, value ? 'true' : 'false');
}

type UseFollowStateOptions = {
  runId: string | undefined;
  searchParams: URLSearchParams;
  updateSearchParams: (mutator: (params: URLSearchParams) => void) => void;
  defaultFollow: boolean;
  onAnnounce?: (message: string) => void;
};

export function useFollowState({
  runId,
  searchParams,
  updateSearchParams,
  defaultFollow,
  onAnnounce,
}: UseFollowStateOptions) {
  const followDefault = useMemo(() => {
    const paramValue = parseFollowValue(searchParams.get('follow'));
    if (paramValue !== null) return paramValue;
    const stored = readGlobalFollowFromStorage();
    if (stored !== null) return stored;
    return defaultFollow;
  }, [searchParams, defaultFollow]);

  const [isFollowing, setIsFollowing] = useState(followDefault);
  const followRef = useRef(isFollowing);
  const hasMigratedLegacyRef = useRef(false);

  useEffect(() => {
    followRef.current = isFollowing;
  }, [isFollowing]);

  useEffect(() => {
    if (!runId) return;
    if (!hasMigratedLegacyRef.current) {
      if (parseFollowValue(searchParams.get('follow')) === null && readGlobalFollowFromStorage() === null) {
        const legacy = readLegacyFollowFromStorage(runId);
        if (legacy !== null) {
          writeGlobalFollowToStorage(legacy);
        }
      }
      hasMigratedLegacyRef.current = true;
    }
    const paramValue = parseFollowValue(searchParams.get('follow'));
    const resolved = paramValue ?? readGlobalFollowFromStorage() ?? defaultFollow;
    setIsFollowing((prev) => (prev === resolved ? prev : resolved));
    followRef.current = resolved;
    writeGlobalFollowToStorage(resolved);
    if (paramValue === null) {
      updateSearchParams((next) => {
        next.set('follow', resolved ? 'true' : 'false');
      });
    }
  }, [runId, searchParams, defaultFollow, updateSearchParams]);

  const persistFollow = useCallback(
    (value: boolean) => {
      writeGlobalFollowToStorage(value);
      updateSearchParams((next) => {
        next.set('follow', value ? 'true' : 'false');
      });
    },
    [updateSearchParams],
  );

  const setFollowing = useCallback(
    (value: boolean, options?: { announceMessage?: string }) => {
      if (followRef.current === value) return;
      followRef.current = value;
      setIsFollowing(value);
      persistFollow(value);
      if (options?.announceMessage && onAnnounce) {
        onAnnounce(options.announceMessage);
      }
    },
    [persistFollow, onAnnounce],
  );

  const toggleFollowing = useCallback(() => {
    const next = !followRef.current;
    setFollowing(next, { announceMessage: next ? 'Follow enabled' : 'Follow disabled' });
  }, [setFollowing]);

  return {
    isFollowing,
    followRef,
    setFollowing,
    toggleFollowing,
  };
}
