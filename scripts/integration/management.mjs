// Verify against the disposable #299 server. Never retry a PATCH in this script.
export async function verifyManagement({
  request,
  error,
  check,
  id,
  businessDate,
  sql,
  hotelPath,
  roomId,
  admin,
  foreign,
  ownerCredentials,
}) {
  const read = async (path, options) => (await request(path, options)).data;
  const send = (method, token, body, expected = 200) => ({
    method,
    token,
    body,
    expected,
  });
  const query = (path, params) => path + "?" + new URLSearchParams(params);
  const owner = (
    await read("/auth/login", send("POST", undefined, ownerCredentials))
  ).accessToken;
  const reservations = "/reservations";
  const room = "/rooms/" + id(roomId);
  const policy = hotelPath + "/cancellation-policy";
  const dates = [60, 61, 62, 63, 68, 69, 70, 71, 5, 6].map(businessDate);
  const [
    first,
    shared,
    added,
    checkout,
    browserFirst,
    browserShared,
    browserAdded,
    browserOut,
    near,
    nearOut,
  ] = dates;
  const original = { checkInDate: first, checkOutDate: added };
  const changed = { checkInDate: shared, checkOutDate: checkout };
  const browserOriginal = {
    checkInDate: browserFirst,
    checkOutDate: browserAdded,
  };
  const browserChanged = {
    checkInDate: browserShared,
    checkOutDate: browserOut,
  };
  const guest = {
    name: "Fixture Guest",
    email: "guest@example.test",
    phone: "010-0000-0000",
  };
  const create = (stay) =>
    read(
      reservations,
      send(
        "POST",
        owner,
        {
          ...stay,
          guestCount: 2,
          roomId,
          representativeGuest: guest,
        },
        201,
      ),
    );
  const detail = (path) => read(path, { token: owner });
  const inventory = (from, to) =>
    read(
      query(room + "/inventories", {
        startDate: from,
        endDate: to,
      }),
      { token: admin },
    );
  const setPolicy = (free, deadline) =>
    read(
      policy,
      send("PUT", admin, {
        freeCancellationDaysBeforeCheckIn: free,
        cancellationDeadlineDaysBeforeCheckIn: deadline,
        feeRules: [{ minDaysBeforeCheckIn: deadline, feeRatePercent: 30 }],
      }),
    );
  const addPrice = (stayDate, nightlyPrice) =>
    read(
      room + "/prices",
      send("POST", admin, { stayDate, nightlyPrice }, 201),
    );
  const setSale = (day, saleStatus) =>
    read(
      room + "/inventories/" + day,
      send("PUT", admin, { totalQuantity: 1, saleStatus }),
    );

  for (const inventoryDate of [
    first,
    shared,
    added,
    browserFirst,
    browserShared,
    browserAdded,
    near,
  ])
    await read(
      room + "/inventories",
      send("POST", admin, { inventoryDate, totalQuantity: 1 }, 201),
    );
  await setPolicy(90, 1);
  for (const date of [first, browserFirst]) await addPrice(date, 16000);
  const created = await create(original);
  const browser = await create(browserOriginal);
  const path = reservations + "/" + id(created.reservationId);
  const browserPath = reservations + "/" + id(browser.reservationId);
  const cancelPath = path + "/cancel";
  for (const date of [shared, browserShared]) await addPrice(date, 17000);
  for (const date of [added, browserAdded]) await addPrice(date, 13000);
  await setPolicy(30, 10);
  const deadline = await create({ checkInDate: near, checkOutDate: nearOut });
  const deadlinePath = reservations + "/" + id(deadline.reservationId);
  await setPolicy(7, 1); // The live policy no longer matches the snapshots.

  const firstPage = await detail(
    reservations + "?status=CONFIRMED&sortBy=ID&direction=ASC&page=0&size=1",
  );
  const secondPage = await detail(
    reservations + "?status=CONFIRMED&sortBy=ID&direction=ASC&page=1&size=1",
  );
  check(
    firstPage.totalElements === 3 &&
      firstPage.totalPages === 3 &&
      firstPage.content[0]?.reservationId === created.reservationId &&
      secondPage.content[0]?.reservationId === browser.reservationId,
    "owner status filter and pagination",
  );
  const snapshot = await detail(path);
  check(
    snapshot.status === "CONFIRMED" &&
      snapshot.roomId === roomId &&
      snapshot.guestCount === 2 &&
      snapshot.totalAmount === 26000 &&
      snapshot.nights.map((night) => night.priceSnapshot).join() ===
        "16000,10000" &&
      snapshot.cancellationPolicySnapshot.freeCancellationDaysBeforeCheckIn ===
        90 &&
      JSON.stringify(snapshot.representativeGuest) ===
        JSON.stringify(created.representativeGuest),
    "stored prices, representative guest and cancellation policy survive live catalog changes",
  );
  await error(reservations + "/2147483647", 404, "RESERVATION_003", {
    token: owner,
  });
  await error(path, 401, "AUTH_001");
  for (const token of [foreign, admin]) {
    await error(path, 403, "RESERVATION_004", { token });
    await error(path, 403, "RESERVATION_004", send("PATCH", token, changed));
    await error(cancelPath, 403, "RESERVATION_004", send("PATCH", token));
  }
  check(
    (await detail(path)).status === "CONFIRMED",
    "foreign access changed no data",
  );
  console.log(
    "PASS owner pages and snapshots; missing 404, anonymous 401 and foreign/ADMIN read-write 403",
  );

  await error(
    path,
    400,
    "RESERVATION_001",
    send("PATCH", owner, { ...changed, checkOutDate: shared }),
  );
  await error(
    path,
    409,
    "BOOKING_POLICY_006",
    send("PATCH", owner, {
      ...changed,
      checkOutDate: businessDate(69),
    }),
  );
  await setSale(added, "CLOSED");
  await error(path, 409, "INVENTORY_009", send("PATCH", owner, changed));
  const unchanged = await detail(path);
  check(
    unchanged.checkInDate === first &&
      unchanged.checkOutDate === added &&
      unchanged.totalAmount === 26000 &&
      (await inventory(first, added)).inventories
        .map((row) => row.reservedQuantity)
        .join() === "1,1,0",
    "fresh GET confirms failed change rolled back and inventory is unchanged",
  );
  await setSale(added, "OPEN");
  const availability = await read(
    query(hotelPath + "/rooms/available", { ...changed, guestCount: 2 }),
  );
  check(
    !availability.content.some((item) => item.roomId === roomId),
    "ordinary availability includes existing shared occupancy",
  );
  const preview = await Promise.all(
    [shared, added].map((day) => read(room + "/prices/" + day)),
  );
  check(
    preview.reduce((total, night) => total + night.nightlyPrice, 0) === 30000,
    "preview for new dates",
  );
  const changeResult = await read(path, send("PATCH", owner, changed));
  const reread = await detail(path);
  check(
    changeResult.reservationNumber === snapshot.reservationNumber &&
      reread.status === "CONFIRMED" &&
      reread.roomId === roomId &&
      reread.guestCount === 2 &&
      reread.checkInDate === shared &&
      reread.checkOutDate === checkout &&
      reread.totalAmount === 30000 &&
      reread.nights
        .map((night) => night.stayDate + ":" + night.priceSnapshot)
        .join() ===
        shared + ":17000," + added + ":13000" &&
      JSON.stringify(reread.cancellationPolicySnapshot) ===
        JSON.stringify(snapshot.cancellationPolicySnapshot) &&
      JSON.stringify(reread.representativeGuest) ===
        JSON.stringify(snapshot.representativeGuest) &&
      (await inventory(first, checkout)).inventories
        .map((row) => row.reservedQuantity)
        .join() === "0,1,1",
    "changed snapshot and released/shared/added inventory",
  );
  const changedList = await detail(
    reservations +
      "?status=CONFIRMED&checkInFrom=" +
      shared +
      "&checkInTo=" +
      shared,
  );
  check(
    changedList.content[0]?.reservationId === created.reservationId &&
      changedList.content[0]?.totalAmount === 30000,
    "owner list reflects change",
  );
  console.log(
    "PASS invalid/policy/closed change rollback and successful shared-date change with repricing",
  );

  await error(
    deadlinePath + "/cancel",
    409,
    "RESERVATION_009",
    send("PATCH", owner),
  );
  check(
    (await detail(deadlinePath)).status === "CONFIRMED" &&
      (await inventory(near, near)).inventories[0]?.reservedQuantity === 1,
    "deadline denial preserves reservation and inventory",
  );
  const review = await detail(path);
  check(
    review.status === "CONFIRMED" &&
      review.cancellationPolicySnapshot.freeCancellationDaysBeforeCheckIn ===
        90 &&
      review.cancellationFeeAmount === null &&
      review.refundAmount === null,
    "fresh detail exposes stored policy, not a pre-cancel quote",
  );
  const cancelled = await read(cancelPath, send("PATCH", owner));
  const saved = await detail(path);
  check(
    cancelled.status === "CANCELLED" &&
      cancelled.cancellationFeeRate === 30 &&
      cancelled.cancellationFeeAmount === 9000 &&
      cancelled.estimatedRefundAmount === 21000 &&
      saved.status === "CANCELLED" &&
      saved.cancellationFeeAmount === 9000 &&
      saved.refundAmount === 21000 &&
      // The immediate Instant can carry finer precision than MySQL TIMESTAMP(6).
      Math.abs(
        Date.parse(saved.cancelledAt) - Date.parse(cancelled.cancelledAt),
      ) <= 1 &&
      saved.cancelledAt.endsWith("Z") &&
      (await inventory(first, checkout)).inventories.every(
        (row) => row.reservedQuantity === 0,
      ),
    "bodyless cancel uses saved policy and returns inventory",
  );
  await error(cancelPath, 409, "RESERVATION_005", send("PATCH", owner));
  await error(path, 409, "RESERVATION_006", send("PATCH", owner, original));
  const cancelledList = await detail(reservations + "?status=CANCELLED");
  check(
    cancelledList.content.some(
      (item) => item.reservationId === created.reservationId,
    ) && (await detail(path)).cancelledAt === saved.cancelledAt,
    "cancelled list and stored result survive rejected follow-ups",
  );
  console.log(
    "PASS fresh cancel review, deadline denial, one successful PATCH and saved fee/refund/inventory",
  );
  console.log(
    `Browser #302 fixture: ${browserPath}; change to ${browserShared} through ${browserOut}`,
  );

  return () => {
    const stored =
      sql(`SELECT status, check_in_date, check_out_date, total_amount,
      COALESCE(cancellation_fee_amount, -1), COALESCE(refund_amount, -1)
      FROM reservations WHERE id=${id(browser.reservationId)};`);
    if (
      stored ===
      `CONFIRMED\t${browserOriginal.checkInDate}\t${browserOriginal.checkOutDate}\t26000.00\t-1.00\t-1.00`
    )
      return console.log("Browser #302 fixture unchanged");
    check(
      stored ===
        `CANCELLED\t${browserChanged.checkInDate}\t${browserChanged.checkOutDate}\t30000.00\t9000.00\t21000.00`,
      "browser saved schedule, fee and refund",
    );
    check(
      sql(`SELECT COUNT(*) FROM room_inventories WHERE room_id=${id(roomId)}
      AND inventory_date BETWEEN '${browserFirst}' AND '${browserAdded}' AND reserved_quantity=0;`) ===
        "3",
      "browser released every occupied date",
    );
    console.log(
      "PASS browser fixture: changed schedule and stored cancellation, all three dates restored",
    );
  };
}
