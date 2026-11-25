export const cachePrefixes = {
  accommodation: "reservation:cache:v2:accommodation-detail::",
  room: "reservation:cache:v3:room-detail::",
};
export const detailTtlMs = (profile) => profile === "detail-lifecycle" ? 15_000 : 600_000;

export function detailCases({ accommodations, rooms }, seed) {
  const hotels = accommodations.slice(0, 4).map(({ id, city, timeZone }, i) => ({
    kind: "accommodation", id, city, timeZone, title: "Load fixture " + seed + "-" + i,
    path: "/accommodations/" + id, name: "detail.accommodation." + (i % 2 === 0 ? "media" : "plain"),
    media: i % 2 === 0,
  }));
  const units = [0, 1, 3, 4].map((index) => {
    const { id, parent, price } = rooms[index];
    const metadata = index % 3 === 0, media = index === 0;
    return { kind: "room", id, parent, price, title: "Room " + index % 3, capacity: 2 + index % 3,
      path: "/rooms/" + id, metadata, media,
      name: "detail.room." + (media ? "media_metadata" : metadata ? "metadata" : "plain") };
  });
  return {
    hotels, units,
    list: { kind: "list", name: "control.catalog", path: "/accommodations?page=0&size=5&sortBy=ID&direction=ASC",
      ids: accommodations.slice(0, 5).map(({ id }) => id), total: accommodations.length },
  };
}

export function detailKey(test) {
  if (!Object.hasOwn(cachePrefixes, test.kind) || !Number.isSafeInteger(test.id) || test.id < 1)
    throw new Error("Unexpected detail cache key");
  return cachePrefixes[test.kind] + test.id;
}

export function detailMatches(test, data) {
  if (test.kind === "list")
    return data?.totalElements === test.total && data.page === 0 && data.size === 5 &&
      Array.isArray(data.content) && data.content.length === test.ids.length &&
      data.content.every((item, n) => item.accommodationId === test.ids[n] && item.status === "ACTIVE");
  if (!data || data.status !== "ACTIVE" || data.name !== test.title ||
      !Array.isArray(data.images) || data.images.length !== Number(test.media)) return false;
  if (test.media) {
    if (!(data.representativeImage?.mediaId > 0) ||
        data.representativeImage.mediaId !== data.images[0].mediaId ||
        data.representativeImage.url !== "/api/v1/media/" + data.images[0].mediaId + "/content") return false;
  } else if (data.representativeImage !== null) return false;
  if (test.kind === "accommodation")
    return data.accommodationId === test.id && data.city === test.city && data.timeZone === test.timeZone &&
      data.description === (test.description ?? "Synthetic catalog");
  return data.roomId === test.id && data.accommodationId === test.parent &&
    data.capacity === test.capacity && data.nightlyPrice === test.price &&
    (test.metadata ? data.metadata?.view === "Courtyard" && data.metadata.bedConfiguration === "Queen" &&
      data.metadata.areaSquareMeters === 28.5 : !Object.hasOwn(data, "metadata"));
}

export function detailReadCase(cases, stage, i) {
  const { hotels, units, list } = cases;
  if (stage === "first") return [...hotels, ...units][i];
  if (stage !== "outage" && i % 5 === 4) return list;
  // Alternate paired hotel/room requests; hold one key per kind in the hot stage.
  const n = stage === "outage" ? i : i - Math.floor(i / 5);
  const group = n % 2 === 0 ? hotels : units;
  return group[stage === "hot" ? 0 : Math.floor(n / 2) % group.length];
}

export function detailBurstCases(cases, kind, mode) {
  const group = kind === "accommodation" ? cases.hotels : kind === "room" ? cases.units : [];
  if (group.length !== 4 || !["same", "distinct"].includes(mode)) throw new Error("Invalid detail burst");
  return mode === "same" ? Array(4).fill(group[0]) : group;
}
