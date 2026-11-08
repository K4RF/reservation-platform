// Drive independent stale snapshots against the real Backend, not a retrying client.
export async function verifyRecovery({
  request,
  error,
  check,
  id,
  businessDate,
  hotelPath,
  roomId,
  admin,
  foreign,
  ownerCredentials,
  seedLockFault,
}) {
  const read = async (path, token) => (await request(path, { token })).data;
  const write = (method, body, token, expected = 200) => ({
    method,
    body,
    token,
    expected,
  });
  const owner = (await request("/auth/login", write("POST", ownerCredentials)))
    .data.accessToken;
  const room = "/rooms/" + id(roomId);
  const prices = room + "/prices";
  const inventories = room + "/inventories";
  const [first, next, faultDay, browserDay, browserOut] = [
    44, 45, 46, 47, 48,
  ].map(businessDate);
  const stay = (checkInDate, checkOutDate) => ({
    checkInDate,
    checkOutDate,
    guestCount: 2,
  });
  const params = (data) => "?" + new URLSearchParams(data);
  const available = (from, to) =>
    read(hotelPath + "/rooms/available" + params(stay(from, to)));
  const inventory = async (date) =>
    (
      await read(
        inventories + params({ startDate: date, endDate: date }),
        admin,
      )
    ).inventories[0];
  const reserve = (from, to) => ({
    ...stay(from, to),
    roomId,
    representativeGuest: {
      name: "Fixture Guest",
      email: "guest@example.test",
      phone: "010-0000-0000",
    },
  });
  for (const inventoryDate of [first, faultDay, browserDay])
    await request(
      inventories,
      write("POST", { inventoryDate, totalQuantity: 1 }, admin, 201),
    );
  const price = () => read(prices + "/" + first);
  const [viewA, viewB, quoteA, quoteB] = await Promise.all([
    available(first, next),
    available(first, next),
    price(),
    price(),
  ]);
  check(
    [viewA, viewB].every((view) =>
      view.content.some((item) => item.roomId === roomId),
    ) &&
      [quoteA, quoteB].every(
        (quote) => quote.source === "DEFAULT" && quote.nightlyPrice === 10000,
      ),
    "independent views read one available room and the same base quote",
  );
  await request(
    prices,
    write("POST", { stayDate: first, nightlyPrice: 19000 }, admin, 201),
  );
  await error(
    prices,
    409,
    "ROOM_PRICE_002",
    write("POST", { stayDate: first, nightlyPrice: 20000 }, admin),
  );
  const freshQuote = await price();
  check(
    freshQuote.source === "DAILY" && freshQuote.nightlyPrice === 19000,
    "stale price create does not replace the saved override",
  );
  const invalid = await error(
    "/reservations",
    400,
    "COMMON_001",
    write(
      "POST",
      {
        ...reserve(first, next),
        representativeGuest: {
          ...reserve(first, next).representativeGuest,
          email: "invalid",
        },
      },
      owner,
    ),
  );
  check(
    invalid.errors.some((item) => item.field === "representativeGuest.email"),
    "real nested validation field",
  );
  const before = await read("/reservations", foreign);
  const created = (
    await request(
      "/reservations",
      write("POST", reserve(first, next), owner, 201),
    )
  ).data;
  await error(
    "/reservations",
    409,
    "INVENTORY_005",
    write("POST", reserve(first, next), foreign),
  );
  const path = "/reservations/" + id(created.reservationId);
  const saved = await read(path, owner);
  check(
    saved.totalAmount === 19000 &&
      (await inventory(first)).reservedQuantity === 1 &&
      !(await available(first, next)).content.some(
        (item) => item.roomId === roomId,
      ) &&
      (await read("/reservations", foreign)).totalElements ===
        before.totalElements,
    "stale availability cannot oversell; successful booking uses the changed price",
  );
  await request(path + "/cancel", write("PATCH", undefined, owner));
  await error(
    path + "/cancel",
    409,
    "RESERVATION_005",
    write("PATCH", undefined, owner),
  );
  check(
    (await read(path, owner)).status === "CANCELLED" &&
      (await inventory(first)).reservedQuantity === 0,
    "stale reservation state does not release stock twice",
  );
  console.log(
    "PASS stale availability, changed price, field validation and cancelled-state conflict",
  );

  const albumPath = room + "/media";
  const a = await request(albumPath, { token: admin });
  const b = await request(albumPath, { token: admin });
  const mediaId = id(a.data.images[0].image.mediaId);
  const metadata = {
    altText: "Recovery fixture A",
    source: "Generated color bars",
    rightsRecord: "Synthetic fixture",
  };
  const editPath = albumPath + "/" + mediaId;
  const edit = (view, body) => ({
    ...write("PUT", body, admin),
    headers: { "If-Match": view.headers.get("etag") },
  });
  await request(editPath, edit(a, metadata));
  await error(
    editPath,
    409,
    "MEDIA_005",
    edit(b, { ...metadata, altText: "Stale fixture B" }),
  );
  const current = await request(albumPath, { token: admin });
  check(
    current.headers.get("etag") !== b.headers.get("etag") &&
      current.data.images[0].image.altText === metadata.altText &&
      (await read(room)).representativeImage?.altText === metadata.altText,
    "stale album edit preserves the winning metadata in management and public reads",
  );
  console.log(
    "PASS independent album reads, stale If-Match 409 and fresh saved metadata",
  );

  const reservationsBeforeFault = (await read("/reservations", foreign))
    .totalElements;
  check(seedLockFault(roomId) === "OK", "isolated Redis fault key was absent");
  await error(
    "/reservations",
    503,
    "INVENTORY_013",
    write("POST", reserve(faultDay, browserDay), foreign),
  );
  check(
    (await read("/reservations", foreign)).totalElements ===
      reservationsBeforeFault &&
      (await inventory(faultDay)).reservedQuantity === 0,
    "injected lock acquisition failure persisted neither reservation nor inventory",
  );
  console.log(
    "PASS real 503 INVENTORY_013 after isolated Redis WRONGTYPE injection; no commit",
  );
  console.log(
    `Browser #304: room ${roomId}, price date ${browserDay}, stay ${browserDay} through ${browserOut}`,
  );
}
