// Only called by the disposable loopback runner. Failed writes are never replayed.
export async function verifyAdmin({
  request,
  error,
  check,
  id,
  businessDate,
  sql,
  picture,
  admin,
  foreign,
  hotel,
  reservationId,
  mediaFiles,
}) {
  const read = async (path, token) => (await request(path, { token })).data;
  const options = (method, body, token = admin, expected = 200) => ({
    method,
    body,
    token,
    expected,
  });
  const write = async (path, method, body, expected) =>
    (await request(path, options(method, body, admin, expected))).data;
  const query = (path, params) => path + "?" + new URLSearchParams(params);
  const accommodationId = id(
    (
      await write(
        "/accommodations",
        "POST",
        { ...hotel, name: "Admin Verification Original" },
        201,
      )
    ).accommodationId,
  );
  const parent = "/accommodations/" + accommodationId;
  const roomRequest = {
    name: "Admin Verification Room",
    capacity: 2,
    nightlyPrice: 10000,
    amenities: ["WIFI"],
  };
  const roomId = id(
    (await write(parent + "/rooms", "POST", roomRequest, 201)).roomId,
  );
  const room = "/rooms/" + roomId;
  const booking = parent + "/booking-policy";
  const cancellation = parent + "/cancellation-policy";
  const prices = room + "/prices";
  const inventories = room + "/inventories";
  const [first, missing, last] = [12, 13, 14].map(businessDate);
  const calendar = query(inventories, { startDate: first, endDate: last });
  const catalogName = "Admin Verification";
  const accessMatrix = [
    ["POST", "/accommodations"],
    ["PUT", parent],
    ["PATCH", parent + "/status"],
    ["POST", parent + "/rooms"],
    ["PUT", room],
    ["PATCH", room + "/status"],
    ["POST", booking],
    ["PUT", cancellation],
    ["POST", prices],
    ["PUT", prices + "/" + first],
    ["POST", inventories],
    ["GET", calendar],
    ["PUT", inventories + "/" + first],
    ["GET", parent + "/media"],
    ["GET", room + "/media"],
    ["POST", parent + "/media"],
    ["POST", "/admin/media/cleanup"],
  ];
  for (const [method, path] of accessMatrix) {
    await error(path, 401, "AUTH_001", { method });
    await error(path, 403, "AUTH_002", { method, token: foreign });
  }
  check(
    (await read("/reservations", admin)).totalElements === 0,
    "ADMIN has no global reservation list",
  );
  const otherReservation = "/reservations/" + id(reservationId);
  for (const [method, path, body] of [
    ["GET", otherReservation],
    ["PATCH", otherReservation, { checkInDate: first, checkOutDate: missing }],
    ["PATCH", otherReservation + "/cancel"],
  ]) {
    await error(path, 403, "RESERVATION_004", options(method, body));
  }
  console.log(
    "PASS anonymous/USER management denial and ADMIN owner-only reservations",
  );

  const getHotel = () => read(parent);
  const getRoom = () => read(room);
  const parentStatus = (status) =>
    write(parent + "/status", "PATCH", { status });
  const roomStatus = (status) => write(room + "/status", "PATCH", { status });
  await error(
    parent,
    400,
    "COMMON_001",
    options("PUT", { ...hotel, name: "" }),
  );
  await error(
    room,
    400,
    "COMMON_001",
    options("PUT", { ...roomRequest, capacity: 0 }),
  );
  await write(parent, "PUT", { ...hotel, name: catalogName + " Updated" });
  await write(room, "PUT", { ...roomRequest, capacity: 3 });
  check(
    (await getHotel()).name === catalogName + " Updated" &&
      (await getRoom()).capacity === 3 &&
      (await getRoom()).accommodationId === accommodationId,
    "fresh catalog reads preserve Room/Accommodation relationship",
  );
  const otherParent =
    "/accommodations/" +
    id(
      (
        await write(
          "/accommodations",
          "POST",
          { ...hotel, name: catalogName + " Secondary" },
          201,
        )
      ).accommodationId,
    );
  const second = await write(
    parent + "/rooms",
    "POST",
    { ...roomRequest, name: "Second Verification Room" },
    201,
  );
  await parentStatus("INACTIVE");
  await roomStatus("INACTIVE");
  const filteredHotels = await read(
    query("/accommodations", {
      name: catalogName,
      city: hotel.city,
      status: "INACTIVE",
      size: 1,
      sortBy: "ID",
    }),
  );
  const roomFilter = { size: 1, minCapacity: 2, sortBy: "ID" };
  const roomPage = (base, params) =>
    read(query(base + "/rooms", { ...roomFilter, ...params }));
  check(
    filteredHotels.totalElements === 1 &&
      filteredHotels.content[0]?.accommodationId === accommodationId &&
      (await getHotel()).status === "INACTIVE" &&
      (await roomPage(parent, { status: "INACTIVE" })).content[0]?.roomId ===
        roomId &&
      (await roomPage(parent, { page: 1 })).content[0]?.roomId ===
        second.roomId &&
      (await roomPage(otherParent, {})).totalElements === 0 &&
      (await getRoom()).status === "INACTIVE",
    "public catalog filters, paging, and parent scope",
  );
  await parentStatus("ACTIVE");
  await roomStatus("ACTIVE");
  check(
    (await getHotel()).status === "ACTIVE" &&
      (await getRoom()).status === "ACTIVE",
    "reactivation is visible",
  );

  const bookingBody = {
    minStayNights: 1,
    maxStayNights: 4,
    minAdvanceBookingDays: 0,
    maxAdvanceBookingDays: 90,
  };
  const cancellationBody = {
    freeCancellationDaysBeforeCheckIn: 7,
    cancellationDeadlineDaysBeforeCheckIn: 1,
    feeRules: [{ minDaysBeforeCheckIn: 1, feeRatePercent: 30 }],
  };
  for (const [path, body, field, value, key, code] of [
    [
      booking,
      bookingBody,
      "maxStayNights",
      3,
      "bookingPolicyId",
      "BOOKING_POLICY",
    ],
    [
      cancellation,
      cancellationBody,
      "freeCancellationDaysBeforeCheckIn",
      9,
      "cancellationPolicyId",
      "CANCELLATION_POLICY",
    ],
  ]) {
    await error(path, 404, code + "_001", options("PUT", body));
    await error(path, 400, "COMMON_001", options("POST", {}));
    const created = await write(path, "POST", body, 201);
    await error(path, 409, code + "_002", options("POST", body));
    const updated = await write(path, "PUT", { ...body, [field]: value });
    check(
      id(created[key]) === updated[key] &&
        updated.accommodationId === accommodationId &&
        updated[field] === value,
      "explicit policy POST/PUT and saved result",
    );
  }
  console.log(
    "PASS catalog scope, update/status rereads and explicit policy operations",
  );

  const datePrice = prices + "/" + first;
  const fallback = await read(datePrice);
  check(
    fallback.source === "DEFAULT" &&
      fallback.roomDailyPriceId === null &&
      fallback.nightlyPrice === 10000,
    "DEFAULT price",
  );
  await error(
    datePrice,
    404,
    "ROOM_PRICE_001",
    options("PUT", { nightlyPrice: 12000 }),
  );
  check(
    (await read(datePrice)).source === "DEFAULT",
    "missing PUT did not create override",
  );
  const override = await write(
    prices,
    "POST",
    { stayDate: first, nightlyPrice: 12000 },
    201,
  );
  await error(
    prices,
    409,
    "ROOM_PRICE_002",
    options("POST", { stayDate: first, nightlyPrice: 1 }),
  );
  check(
    (await read(datePrice)).nightlyPrice === 12000,
    "duplicate POST did not replace override",
  );
  await write(datePrice, "PUT", { nightlyPrice: 13000 });
  const daily = await read(datePrice);
  check(
    daily.roomDailyPriceId === id(override.roomDailyPriceId) &&
      daily.source === "DAILY" &&
      daily.roomId === roomId &&
      daily.stayDate === first &&
      daily.nightlyPrice === 13000,
    "effective price is updated for only the selected day and room",
  );

  for (const inventoryDate of [first, last])
    await write(inventories, "POST", { inventoryDate, totalQuantity: 2 }, 201);
  const readCalendar = async () => (await read(calendar, admin)).inventories;
  check(
    (await readCalendar()).map((entry) => entry.inventoryDate).join() ===
      [first, last].join(),
    "inclusive Calendar omits uncreated dates",
  );
  const adminReservation = await write(
    "/reservations",
    "POST",
    {
      roomId,
      checkInDate: first,
      checkOutDate: missing,
      guestCount: 1,
      representativeGuest: {
        name: "Fixture Guest",
        email: "guest@example.test",
        phone: "010-0000-0000",
      },
    },
    201,
  );
  const mine = "/reservations/" + id(adminReservation.reservationId);
  const myPage = await read("/reservations", admin);
  check(
    myPage.totalElements === 1 &&
      myPage.content[0]?.reservationId === adminReservation.reservationId &&
      (await read(mine, admin)).cancellationPolicySnapshot
        .freeCancellationDaysBeforeCheckIn === 9,
    "ADMIN only sees own reservation and stored cancellation policy",
  );
  const inventoryDate = inventories + "/" + first;
  await error(
    inventoryDate,
    409,
    "INVENTORY_006",
    options("PUT", { totalQuantity: 0, saleStatus: "CLOSED" }),
  );
  const before = (await readCalendar())[0];
  check(
    before.totalQuantity === 2 &&
      before.reservedQuantity === 1 &&
      before.saleStatus === "OPEN",
    "below occupancy failure leaves Calendar unchanged",
  );
  await write(inventoryDate, "PUT", { totalQuantity: 2, saleStatus: "CLOSED" });
  await roomStatus("INACTIVE");
  await error(
    inventoryDate,
    409,
    "INVENTORY_008",
    options("PUT", { totalQuantity: 3, saleStatus: "OPEN" }),
  );
  await error(
    inventories,
    409,
    "INVENTORY_008",
    options("POST", { inventoryDate: missing, totalQuantity: 1 }),
  );
  const after = await readCalendar();
  check(
    after.length === 2 &&
      after[0].reservedQuantity === 1 &&
      after[0].totalQuantity === 2 &&
      after[0].availableQuantity === 1 &&
      after[0].saleStatus === "CLOSED" &&
      (await read(mine, admin)).totalAmount === 13000,
    "inactive room Calendar remains readable; closing does not release existing occupancy",
  );
  console.log(
    "PASS price source and failed-write state; Calendar gaps, inactive restrictions and CLOSED occupancy",
  );

  const { verifyAdminAlbums } = await import("./admin-media.mjs");
  await verifyAdminAlbums({
    request,
    read,
    error,
    check,
    id,
    sql,
    picture,
    admin,
    mediaFiles,
    albums: [
      [parent, accommodationId, "ACCOMMODATION"],
      [room, roomId, "ROOM"],
    ],
  });
  console.log(
    `Browser #303 fixture: accommodation ${accommodationId}, room ${roomId}, dates ${first} through ${last}`,
  );
}
