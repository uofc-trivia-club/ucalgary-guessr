// Count only active time; sessionStorage preserves progress when this tab returns.
export function createActiveTimer({ now = () => performance.now(), storage = null } = {}) {
  let key = null;
  let accumulated = 0;
  let runningSince = null;
  function elapsed() {
    return Math.floor(accumulated + (runningSince === null ? 0 : Math.max(0, now() - runningSince)));
  }
  function checkpoint() {
    if (key) {
      try { storage?.setItem(key, String(elapsed())); } catch { /* Storage can be blocked. */ }
    }
  }
  function pause() {
    accumulated = elapsed();
    runningSince = null;
    checkpoint();
    return accumulated;
  }
  return {
    elapsed, checkpoint, pause,
    start(nextKey) {
      if (key) pause();
      key = 'guessr-daily-time:' + nextKey;
      accumulated = 0;
      runningSince = null;
      try {
        const saved = Number(storage?.getItem(key));
        if (Number.isSafeInteger(saved) && saved >= 0) accumulated = saved;
      } catch { /* Start normally when browser storage is unavailable. */ }
    },
    resume() { if (runningSince === null) runningSince = now(); }
  };
}
