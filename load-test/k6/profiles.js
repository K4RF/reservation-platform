// Measured bounds, not throughput targets. No arbitrary VUs or URLs on the CLI.
import { stayNights, stayPageSizes, staySpecs } from "./stay-cases.js";

export const profiles = {
  smoke: { smoke: 1 },
  baseline: { reads: 8, writers: 2, writes: 2 },
  "read-heavy": { rate: 2, seconds: 12, readVus: 2 },
  "write-heavy": { writers: 4, writes: 3 },
  mixed: { rate: 2, seconds: 12, readVus: 2, writers: 2, writes: 2 },
  exhaustion: { writers: 4, writes: 1 },
};

export function plan(profile, cache, roomMode, catalogSize) {
  if (["lifecycle-write", "lifecycle-history", "lifecycle-race", "lifecycle-broker-down"].includes(profile)) {
    if (catalogSize !== undefined || cache !== "off" || roomMode !== "distributed")
      throw new Error("Lifecycle profiles require the fixed fixture, cache=off and distributed mode");
    const lifecycle = profile.slice(10);
    if (lifecycle === "broker-down") return { lifecycle, stages: [
      { name: "burst", iterations: 1, seconds: 15, at: 0, vus: 1 },
    ] };
    if (lifecycle === "race") return { lifecycle, stages: [
      { name: "race_mixed", iterations: 2, seconds: 5, at: 0, vus: 2 },
      { name: "race_cancel", iterations: 2, seconds: 5, at: 8, vus: 2 },
    ] };
    return { lifecycle, stages: [
      { name: "low", rate: 1, seconds: 6, at: 0, vus: 1 },
      { name: "ramp", rate: 2, seconds: 6, at: 8, vus: 2 },
      { name: "steady", rate: 3, seconds: 8, at: 16, vus: 3 },
    ] };
  }
  if (["create-hot", "create-distributed", "create-exhaustion", "create-redis-down", "create-peer"].includes(profile)) {
    const creation = profile.slice(7);
    if (catalogSize !== undefined || cache !== "off" || roomMode !== (creation === "distributed" ? "distributed" : "hot"))
      throw new Error("Creation profiles require cache=off, the matching room mode and the fixed base fixture");
    if (creation === "exhaustion" || creation === "peer" || creation === "redis-down") {
      const vus = creation === "redis-down" ? 1 : 4;
      return { creation, stages: [{ name: "burst", iterations: vus, seconds: 20, at: 0, vus }] };
    }
    return { creation, stages: [
      { name: "low", rate: 1, seconds: 6, at: 0, vus: 1 },
      { name: "shared", rate: 2, seconds: 5, at: 8, vus: 2 },
      { name: "overlap", iterations: 3, seconds: 5, at: 15, vus: 3 },
      { name: "disjoint", iterations: 3, seconds: 5, at: 22, vus: 3 },
      { name: "steady", rate: 3, seconds: 8, at: 29, vus: 3 },
    ] };
  }
  if (["stay-availability", "stay-price", "stay-journey"].includes(profile)) {
    if (!Object.hasOwn(staySpecs, catalogSize) || cache !== "off" || roomMode !== "distributed")
      throw new Error("Stay profiles require small/expanded fixture, cache=off, and distributed mode");
    return { stayRead: profile.slice(5), catalogSize,
      stayFixture: { ...staySpecs[catalogSize], nights: stayNights, pageSizes: stayPageSizes }, stages: [
        { name: "low", rate: 1, seconds: 8, at: 0, vus: 1 },
        { name: "popular", rate: 2, seconds: 6, at: 10, vus: 2 },
        { name: "dispersed", rate: 2, seconds: 6, at: 18, vus: 2 },
        { name: "steady", rate: 3, seconds: 8, at: 26, vus: 3 },
      ] };
  }
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
  if (catalogSize !== undefined) throw new Error("Catalog size is only supported by catalog and stay profiles");
  if (["detail-reads", "detail-outage", "detail-lifecycle"].includes(profile)) {
    if (roomMode !== "distributed" || !(profile === "detail-reads" ? ["off", "cold", "warm"].includes(cache) : cache === "warm"))
      throw new Error("Invalid detail cache profile settings");
    const detail = profile.slice(7);
    if (detail === "lifecycle") return { detail };
    if (detail === "outage") return { detail, stages: [
      { name: "outage", rate: 1, seconds: 12, at: 0, vus: 2 },
    ] };
    return { detail, stages: [
      { name: "first", iterations: 8, seconds: 8, at: 0, vus: 1 },
      { name: "hot", rate: 2, seconds: 6, at: 9, vus: 2 },
      { name: "distributed", rate: 2, seconds: 6, at: 17, vus: 2 },
      { name: "steady", rate: 3, seconds: 8, at: 25, vus: 3 },
    ] };
  }
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
