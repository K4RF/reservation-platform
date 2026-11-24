// Measured bounds, not throughput targets. No arbitrary VUs or URLs on the CLI.
export const profiles = {
  smoke: { smoke: 1 },
  baseline: { reads: 8, writers: 2, writes: 2 },
  "read-heavy": { rate: 2, seconds: 12, readVus: 2 },
  "write-heavy": { writers: 4, writes: 3 },
  mixed: { rate: 2, seconds: 12, readVus: 2, writers: 2, writes: 2 },
  exhaustion: { writers: 4, writes: 1 },
};

export function plan(profile, cache, roomMode, catalogSize) {
  if (["catalog-search", "catalog-suggest", "catalog-journey"].includes(profile)) {
    if (!["small", "expanded"].includes(catalogSize) || cache !== "off" || roomMode !== "distributed")
      throw new Error("Catalog profiles require small/expanded fixture, cache=off, and distributed mode");
    return { catalog: profile.slice(8), catalogSize, stages: [
      { name: "low", rate: 1, seconds: 12, at: 0, vus: 1 },
      { name: "popular", rate: 2, seconds: 8, at: 14, vus: 2 },
      { name: "dispersed", rate: 2, seconds: 8, at: 24, vus: 2 },
      { name: "steady", rate: 3, seconds: 12, at: 34, vus: 3 },
    ] };
  }
  if (catalogSize !== undefined) throw new Error("Catalog size is only supported by catalog profiles");
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
