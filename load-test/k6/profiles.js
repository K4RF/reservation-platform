// Measured bounds, not throughput targets. No arbitrary VUs or URLs on the CLI.
export const profiles = {
  smoke: { smoke: 1 },
  baseline: { reads: 8, writers: 2, writes: 2 },
  "read-heavy": { rate: 2, seconds: 12, readVus: 2 },
  "write-heavy": { writers: 4, writes: 3 },
  mixed: { rate: 2, seconds: 12, readVus: 2, writers: 2, writes: 2 },
  exhaustion: { writers: 4, writes: 1 },
};

export function plan(profile, cache, roomMode) {
  if (!Object.hasOwn(profiles, profile)) throw new Error("Unknown profile");
  if (!["cold", "warm", "off"].includes(cache)) throw new Error("Unknown cache mode");
  if (!["hot", "distributed"].includes(roomMode)) throw new Error("Unknown room mode");
  if (profile === "exhaustion" && roomMode !== "hot")
    throw new Error("Exhaustion explicitly requires hot mode");
  if (cache === "cold" && !["smoke", "baseline", "read-heavy"].includes(profile))
    throw new Error("Cold mode requires a bounded first pass over detail keys");
  const p = { ...profiles[profile] };
  if (cache === "cold" && p.rate) {
    delete p.rate;
    delete p.seconds;
    delete p.readVus;
    p.reads = 8;
  }
  return p;
}
