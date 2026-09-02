export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createThrottle(minIntervalMs) {
  let lastCallAt = 0;
  let chain = Promise.resolve();

  return function throttle() {
    const runNext = chain.then(async () => {
      const elapsed = Date.now() - lastCallAt;
      const wait = Math.max(0, minIntervalMs - elapsed);
      if (wait > 0) await sleep(wait);
      lastCallAt = Date.now();
    });
    chain = runNext;
    return runNext;
  };
}
