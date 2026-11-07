// Runs against the #299 disposable stack only. Browser and HTTP use different stay dates.
export async function verifyBooking({
  request,
  error,
  check,
  id,
  businessDate,
  sql,
  hotel,
  hotelPath,
  roomId,
  admin,
  guest,
  ownerId,
}) {
  const [
    browserIn,
    browserSecond,
    browserOut,
    checkIn,
    second,
    checkOut,
    tooLong,
  ] = [40, 41, 42, 50, 51, 52, 58].map(businessDate);
  const stay = { checkInDate: checkIn, checkOutDate: checkOut, guestCount: 2 };
  const browserStay = {
    checkInDate: browserIn,
    checkOutDate: browserOut,
    guestCount: 2,
  };
  const read = async (path, options) => (await request(path, options)).data;
  const write = (path, body, method = "POST") =>
    read(path, {
      method,
      body,
      token: admin,
      expected: method === "POST" ? 201 : 200,
    });
  const query = (path, params) => path + "?" + new URLSearchParams(params);
  const legacy = await write("/accommodations", {
    ...hotel,
    name: "Legacy Fixture Hotel",
    amenities: ["PARKING"],
  });
  const legacyPath = "/accommodations/" + id(legacy.accommodationId);
  const room = async (path, name, capacity = 2, nightlyPrice = 10000) =>
    id(
      (
        await write(path + "/rooms", {
          name,
          capacity,
          nightlyPrice,
          amenities: ["WIFI"],
        })
      ).roomId,
    );
  const legacyRoom = await room(legacyPath, "Legacy Fixture Room", 2, 9000);
  const small = await room(hotelPath, "Single Fixture Room", 1);
  const inactive = await room(hotelPath, "Inactive Fixture Room");
  const closed = await room(hotelPath, "Closed Fixture Room");
  const soldOut = await room(hotelPath, "Unavailable Fixture Room");
  const inventory = (room) => `/rooms/${room}/inventories`;
  for (const [target, totalQuantity] of [
    [roomId, 1],
    [legacyRoom, 1],
    [small, 1],
    [inactive, 1],
    [closed, 1],
    [soldOut, 0],
  ]) {
    for (const inventoryDate of [browserIn, browserSecond, checkIn, second])
      await write(inventory(target), { inventoryDate, totalQuantity });
  }
  await write(`/rooms/${inactive}/status`, { status: "INACTIVE" }, "PATCH");
  for (const date of [browserIn, checkIn])
    await write(
      inventory(closed) + "/" + date,
      { totalQuantity: 1, saleStatus: "CLOSED" },
      "PUT",
    );

  const catalog = (params) =>
    read(
      query("/accommodations", {
        city: hotel.city,
        status: "ACTIVE",
        ...params,
      }),
    );
  const firstPage = await catalog({
    sortBy: "NAME",
    direction: "ASC",
    page: 0,
    size: 1,
  });
  const secondPage = await catalog({
    sortBy: "NAME",
    direction: "ASC",
    page: 1,
    size: 1,
  });
  check(
    firstPage.totalElements === 2 &&
      firstPage.totalPages === 2 &&
      firstPage.content[0].representativeImage?.mediaId &&
      secondPage.content[0].accommodationId === legacy.accommodationId &&
      secondPage.content[0].representativeImage === null &&
      secondPage.content[0].images.length === 0,
    "real search pages with and without Media",
  );
  const reverse = await catalog({ sortBy: "NAME", direction: "DESC", size: 1 });
  check(
    reverse.content[0].accommodationId === legacy.accommodationId,
    "NAME descending",
  );
  const and = await catalog({
    ...stay,
    accommodationAmenities: "PARKING,BREAKFAST",
    roomAmenities: "WIFI",
  });
  check(
    and.totalElements === 1 &&
      and.content[0].accommodationId === firstPage.content[0].accommodationId,
    "AND amenities and dated search",
  );
  check(
    (await catalog({ name: "no-such-fixture" })).totalElements === 0,
    "empty search",
  );
  await error(
    query("/accommodations", { checkInDate: checkIn, checkOutDate: checkIn }),
    400,
    "ACCOMMODATION_003",
  );
  await error(query("/accommodations", { guestCount: 0 }), 400, "COMMON_001");
  await error("/media/2147483647/content", 404, "MEDIA_001");
  const catalogRoom = await read(`/rooms/${roomId}`);
  check(
    catalogRoom.roomId === roomId &&
      catalogRoom.accommodationId === and.content[0].accommodationId,
    "room detail identity",
  );
  const available = (params) =>
    read(query(hotelPath + "/rooms/available", params));
  const initial = await available(stay);
  check(
    initial.totalElements === 1 && initial.content[0].roomId === roomId,
    "capacity, inactive, closed and zero stock are excluded from availability",
  );
  check(
    (await available({ ...stay, guestCount: 3 })).totalElements === 0,
    "over-capacity availability",
  );

  const body = (overrides = {}) => ({
    roomId,
    ...stay,
    representativeGuest: {
      name: "Synthetic Guest",
      email: "guest@example.test",
      phone: "010-0000-0000",
    },
    ...overrides,
  });
  const submit = (booking, token) => ({ method: "POST", body: booking, token });
  await error("/reservations", 401, "AUTH_001", submit(body()));
  await error(
    "/reservations",
    400,
    "RESERVATION_008",
    submit(body({ guestCount: 3 }), guest),
  );
  await error(
    "/reservations",
    409,
    "ROOM_004",
    submit(body({ roomId: inactive }), guest),
  );
  await error(
    "/reservations",
    409,
    "INVENTORY_009",
    submit(body({ roomId: closed }), guest),
  );
  await error(
    "/reservations",
    409,
    "INVENTORY_005",
    submit(body({ roomId: soldOut }), guest),
  );
  await error(
    "/reservations",
    409,
    "BOOKING_POLICY_006",
    submit(body({ checkOutDate: tooLong }), guest),
  );
  check(
    (await read("/reservations", { token: guest })).totalElements === 0,
    "rejected writes saved nothing",
  );
  console.log(
    "PASS real search AND/NAME/pages/Media and availability/booking rejection gates",
  );

  const prices = `/rooms/${roomId}/prices`;
  await write(prices, { stayDate: browserIn, nightlyPrice: 16000 });
  await write(prices, { stayDate: checkIn, nightlyPrice: 16000 });
  const preview = await Promise.all(
    [checkIn, second].map((date) => read(prices + "/" + date)),
  );
  check(
    preview[0].source === "DAILY" &&
      preview[1].source === "DEFAULT" &&
      preview.reduce((total, night) => total + night.nightlyPrice, 0) === 26000,
    "mixed preview",
  );
  await write(prices + "/" + checkIn, { nightlyPrice: 17000 }, "PUT");
  const created = await read("/reservations", {
    ...submit(body(), guest),
    expected: 201,
  });
  const confirmed = await read("/reservations/" + id(created.reservationId), {
    token: guest,
  });
  check(
    created.status === "CONFIRMED" &&
      confirmed.reservationNumber === created.reservationNumber &&
      /^RSV-\d{8}-[A-F0-9]{16}$/.test(confirmed.reservationNumber) &&
      confirmed.totalAmount === 27000 &&
      confirmed.stayNights === 2 &&
      confirmed.nights[0].stayDate === checkIn &&
      confirmed.nights[0].priceSnapshot === 17000 &&
      confirmed.nights[1].stayDate === second &&
      confirmed.nights[1].priceSnapshot === 10000 &&
      confirmed.representativeGuest?.name === body().representativeGuest.name,
    "confirmed amount/guest/two-night snapshot from owner GET",
  );
  await error("/reservations", 409, "INVENTORY_005", submit(body(), admin));
  check(
    (await available(stay)).totalElements === 0,
    "availability disappears after last unit",
  );
  const calendar = await read(
    query(inventory(roomId), { startDate: checkIn, endDate: checkOut }),
    { token: admin },
  );
  check(
    calendar.inventories
      .map((row) => row.inventoryDate + ":" + row.reservedQuantity)
      .join() === [checkIn, second].map((date) => date + ":1").join(),
    "checkout excluded and rejected write consumed no inventory",
  );
  check(
    (await read("/reservations", { token: guest })).totalElements === 1,
    "one confirmed write for the owner",
  );
  console.log(
    "PASS actual booking: preview 26000, saved 27000, two nights and last-unit conflict",
  );
  check(
    (await available(browserStay)).content.some((row) => row.roomId === roomId),
    "separate browser stay available",
  );
  console.log(
    `Browser #301 fixture: ${hotel.city}; ${browserIn} to ${browserOut}; guests 2`,
  );

  return () => {
    // Keep failed verification available for inspection. Do not print fixture guest data.
    const rows =
      sql(`SELECT status, DATEDIFF(check_out_date, check_in_date), total_amount FROM reservations
      WHERE room_id=${id(roomId)} AND member_id=${id(ownerId)}
        AND check_in_date='${browserIn}' AND check_out_date='${browserOut}';`);
    if (!rows)
      return console.log("No reservation submitted for the browser fixture");
    check(
      rows === "CONFIRMED\t2\t26000.00",
      "exactly one browser reservation with expected stored amount",
    );
    console.log(
      "PASS browser fixture: one confirmed row, two nights, stored amount 26000",
    );
  };
}
