type RefreshResult = { accessToken: string; refreshToken: string };

let inflight: Promise<RefreshResult> | null = null;

export function runSingleFlightRefresh(
  doRefresh: () => Promise<RefreshResult>,
): Promise<RefreshResult> {
  if (inflight) {
    return inflight;
  }

  inflight = doRefresh().finally(() => {
    inflight = null;
  });

  return inflight;
}
