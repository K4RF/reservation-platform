import { randomBytes } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

const picture = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAABgAAAAMCAYAAAB4MH11AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAoSURBVDhPY/j//8N/WmIGdAFq42FggVvTlv+0xKMWEMSjFhDENLcAAHQnVU4wDObtAAAAAElFTkSuQmCC",
  "base64",
);

function check(condition, label) {
  if (!condition) throw new Error(`Contract check failed: ${label}`);
}

function id(value) {
  check(Number.isSafeInteger(value) && value > 0, "positive numeric ID");
  return value;
}

function businessDate(offset = 0) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts();
  const part = (name) => Number(parts.find(({ type }) => type === name).value);
  return new Date(
    Date.UTC(part("year"), part("month") - 1, part("day") + offset),
  )
    .toISOString()
    .slice(0, 10);
}

// Called only after run.mjs creates a new loopback-only stack. Never retry a write here.
export async function verifyContract({
  apiOrigin,
  webOrigin,
  sql,
  fixturePassword,
  booking,
  management,
  adminVerification,
}) {
  async function request(
    path,
    { method = "GET", body, token, expected = 200, headers = {}, direct } = {},
  ) {
    const isForm = body instanceof FormData;
    const response = await fetch(
      (direct ? apiOrigin : webOrigin + "/api/v1") + path,
      {
        method,
        redirect: "manual",
        signal: AbortSignal.timeout(15_000),
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(body !== undefined && !isForm
            ? { "Content-Type": "application/json" }
            : {}),
          ...headers,
        },
        body: isForm || body === undefined ? body : JSON.stringify(body),
      },
    );
    // The diagnostic never includes query values, response bodies or request headers.
    check(
      response.status === expected,
      `${method} ${path.split("?")[0]} expected ${expected}, got ${response.status}`,
    );
    const type = response.headers.get("content-type") ?? "";
    const data = type.includes("json")
      ? await response.json()
      : await response.arrayBuffer();
    return { data, headers: response.headers, type };
  }

  async function error(path, expected, code, options) {
    const { data } = await request(path, { ...options, expected });
    check(
      data?.status === expected && data?.code === code,
      `ErrorResponse ${expected} ${code}`,
    );
    check(
      typeof data.message === "string" &&
        data.path === "/api/v1" + path.split("?")[0],
      "error message/path",
    );
    return data;
  }

  const { data: openapi } = await request("/v3/api-docs", { direct: true });
  const swagger = await request("/swagger-ui.html", {
    direct: true,
    expected: 302,
  });
  check(
    swagger.headers.get("location")?.endsWith("/swagger-ui/index.html"),
    "Swagger UI redirect",
  );
  check(
    (await request("/swagger-ui/index.html", { direct: true })).type.includes(
      "text/html",
    ),
    "Swagger UI HTML",
  );
  for (const [path, methods] of Object.entries({
    "/members": "post",
    "/auth/login": "post",
    "/auth/reissue": "post",
    "/auth/logout": "post",
    "/auth/oauth2/google/start": "get",
    "/auth/oauth2/exchange": "post",
    "/accommodations": "get post",
    "/accommodations/{accommodationId}": "get put",
    "/accommodations/{accommodationId}/status": "patch",
    "/accommodations/{accommodationId}/rooms": "get post",
    "/accommodations/{accommodationId}/rooms/available": "get",
    "/rooms/{roomId}": "get put",
    "/rooms/{roomId}/status": "patch",
    "/rooms/{roomId}/prices": "post",
    "/rooms/{roomId}/prices/{stayDate}": "get put",
    "/rooms/{roomId}/inventories": "get post",
    "/rooms/{roomId}/inventories/{inventoryDate}": "put",
    "/accommodations/{accommodationId}/booking-policy": "post put",
    "/accommodations/{accommodationId}/cancellation-policy": "post put",
    "/reservations": "get post",
    "/reservations/cursor": "get",
    "/reservations/{reservationId}": "get patch",
    "/reservations/{reservationId}/cancel": "patch",
    "/accommodations/{ownerId}/media": "get post",
    "/rooms/{ownerId}/media": "get post",
    "/media/{mediaId}/content": "get",
  })) {
    for (const method of methods.split(" "))
      check(
        openapi.paths["/api/v1" + path]?.[method],
        `OpenAPI ${method} ${path}`,
      );
  }
  check(
    openapi.components?.securitySchemes?.bearerAuth?.scheme === "bearer",
    "OpenAPI bearerAuth",
  );
  check(
    openapi.paths["/api/v1/reservations"].post.security?.some(
      (entry) => "bearerAuth" in entry,
    ),
    "protected OpenAPI operation",
  );
  check(
    (await request("/accommodations?size=2")).data.totalElements === 0,
    "fresh catalog through Vite proxy",
  );
  check(
    sql("SELECT DATABASE();") === "reservation_integration",
    "isolated MySQL identity",
  );
  console.log("PASS Swagger/OpenAPI, blank isolated catalog and Vite proxy");

  const users = ["owner", "other", "admin"].map((name) => ({
    email: `fixture-${name}@example.test`,
    password: fixturePassword ?? randomBytes(16).toString("hex"),
  }));
  const invalid = await error("/members", 400, "COMMON_001", {
    method: "POST",
    body: { email: "invalid", password: "short" },
  });
  check(
    invalid.errors?.some(({ field }) => field === "email"),
    "validation field details",
  );
  const memberIds = [];
  for (const body of users) {
    const signedUp = await request("/members", {
      method: "POST",
      body,
      expected: 201,
    });
    const memberId = id(signedUp.data.memberId);
    check(
      signedUp.data.role === "USER" &&
        signedUp.headers.get("location")?.endsWith("/members/" + memberId),
      "signup response",
    );
    memberIds.push(memberId);
  }
  // Only the isolated DB, never a shared database: promote the exact signup fixture row.
  check(
    sql(
      `UPDATE members SET role='ADMIN' WHERE id=${memberIds[2]} AND role='USER'; SELECT ROW_COUNT();`,
    ) === "1",
    "isolated admin fixture",
  );
  const sessions = [];
  for (const body of users) {
    const { data } = await request("/auth/login", { method: "POST", body });
    check(
      data.tokenType === "Bearer" && data.accessToken && data.refreshToken,
      "email login token pair",
    );
    sessions.push(data);
  }
  const [ownerSession, foreignSession, adminSession] = sessions;
  const reissue = await request("/auth/reissue", {
    method: "POST",
    body: { refreshToken: ownerSession.refreshToken },
  });
  check(
    reissue.data.accessToken && reissue.data.tokenType === "Bearer",
    "Redis refresh token reissue",
  );
  const owner = reissue.data.accessToken;
  const foreign = foreignSession.accessToken;
  const admin = adminSession.accessToken;
  await error("/reservations", 401, "AUTH_001");
  await error("/accommodations", 403, "AUTH_002", {
    method: "POST",
    token: foreign,
    body: {},
  });
  console.log("PASS email signup/login, Redis reissue and 400/401/403");

  const hotel = {
    name: "Integration Fixture Hotel",
    description: "Synthetic integration catalog",
    country: "대한민국",
    city: "서울특별시",
    region: "종로구",
    address: "Fixture address",
    checkInTime: "15:00:00",
    checkOutTime: "11:00:00",
    timeZone: "Asia/Seoul",
    amenities: booking ? ["PARKING", "BREAKFAST"] : ["PARKING"],
  };
  const accommodation = (
    await request("/accommodations", {
      method: "POST",
      body: hotel,
      token: admin,
      expected: 201,
    })
  ).data;
  const hotelPath = "/accommodations/" + id(accommodation.accommodationId);
  const room = (
    await request(hotelPath + "/rooms", {
      method: "POST",
      token: admin,
      expected: 201,
      body: {
        name: "Integration Fixture Room",
        capacity: 2,
        nightlyPrice: 10000,
        amenities: ["WIFI"],
      },
    })
  ).data;
  const roomId = id(room.roomId);
  const roomPath = "/rooms/" + roomId;
  check(
    room.accommodationId === accommodation.accommodationId &&
      room.status === "ACTIVE",
    "room parent and status",
  );
  const catalog = await request(
    "/accommodations?status=ACTIVE&sortBy=NAME&direction=ASC&page=0&size=2&city=" +
      encodeURIComponent(hotel.city),
  );
  check(
    catalog.data.content?.[0]?.accommodationId ===
      accommodation.accommodationId && catalog.data.totalElements === 1,
    "search page and city filter",
  );
  const legacy = (await request(hotelPath)).data;
  check(
    legacy.timeZone === "Asia/Seoul" &&
      legacy.representativeImage === null &&
      legacy.images?.length === 0,
    "time zone and absent catalog media",
  );
  await error("/rooms/2147483647", 404, "ROOM_001");
  const bookingPolicy = {
    minStayNights: 1,
    maxStayNights: 7,
    minAdvanceBookingDays: 0,
    maxAdvanceBookingDays: 90,
  };
  const cancellationPolicy = {
    freeCancellationDaysBeforeCheckIn: 7,
    cancellationDeadlineDaysBeforeCheckIn: 1,
    feeRules: [{ minDaysBeforeCheckIn: 1, feeRatePercent: 30 }],
  };
  for (const [path, body] of [
    ["booking-policy", bookingPolicy],
    ["cancellation-policy", cancellationPolicy],
  ]) {
    const policy = hotelPath + "/" + path;
    await request(policy, {
      method: "POST",
      body,
      token: admin,
      expected: 201,
    });
    await request(policy, { method: "PUT", body, token: admin });
  }

  const [first, second, third, fourth] = [30, 31, 32, 33].map(businessDate);
  const inventory = roomPath + "/inventories";
  for (const inventoryDate of [first, second, third])
    await request(inventory, {
      method: "POST",
      token: admin,
      expected: 201,
      body: { inventoryDate, totalQuantity: 1 },
    });
  const getInventory = async () =>
    (
      await request(`${inventory}?startDate=${first}&endDate=${third}`, {
        token: admin,
      })
    ).data.inventories;
  const dates = await getInventory();
  check(
    dates.map((item) => item.inventoryDate).join() ===
      [first, second, third].join(),
    "inclusive inventory calendar",
  );
  const changedInventory = (
    await request(inventory + "/" + third, {
      method: "PUT",
      token: admin,
      body: { totalQuantity: 2, saleStatus: "OPEN" },
    })
  ).data;
  check(
    changedInventory.inventoryDate === third &&
      changedInventory.totalQuantity === 2,
    "date inventory update",
  );
  const price = roomPath + "/prices";
  await request(price, {
    method: "POST",
    token: admin,
    expected: 201,
    body: { stayDate: first, nightlyPrice: 15000 },
  });
  const daily = (await request(price + "/" + first)).data;
  const fallback = (await request(price + "/" + second)).data;
  check(
    daily.source === "DAILY" &&
      daily.nightlyPrice === 15000 &&
      daily.stayDate === first,
    "daily price",
  );
  check(
    fallback.source === "DEFAULT" &&
      fallback.nightlyPrice === 10000 &&
      fallback.roomDailyPriceId === null,
    "base fallback",
  );
  const priceUpdate = (
    await request(price + "/" + first, {
      method: "PUT",
      token: admin,
      body: { nightlyPrice: 16000 },
    })
  ).data;
  check(
    priceUpdate.roomDailyPriceId === daily.roomDailyPriceId &&
      priceUpdate.nightlyPrice === 16000,
    "daily price update",
  );
  console.log(
    "PASS catalog/room, policy writes, inclusive inventory and DAILY/DEFAULT prices",
  );

  const albumPath = hotelPath + "/media";
  const album = await request(albumPath, { token: admin });
  const etag = album.headers.get("etag");
  check(
    /^[a-f0-9]{64}$/.test(album.data.revision) &&
      etag === `"${album.data.revision}"`,
    "strong album ETag",
  );
  async function upload(path, revision, altText) {
    const form = new FormData();
    form.append(
      "file",
      new Blob([picture], { type: "image/png" }),
      "fixture.png",
    );
    form.append(
      "metadata",
      new Blob(
        [
          JSON.stringify({
            altText,
            source: "Generated color bars",
            rightsRecord: "Synthetic integration fixture",
          }),
        ],
        { type: "application/json" },
      ),
    );
    return request(path, {
      method: "POST",
      token: admin,
      body: form,
      headers: { "If-Match": revision },
      expected: 201,
    });
  }
  const uploaded = await upload(albumPath, etag, "Synthetic color bars");
  const mediaId = id(uploaded.data.images[0].image.mediaId);
  await error(albumPath + "/" + mediaId + "/representative", 409, "MEDIA_005", {
    method: "PATCH",
    token: admin,
    headers: { "If-Match": etag },
  });
  const recovered = await request(albumPath, { token: admin });
  check(
    recovered.headers.get("etag") === uploaded.headers.get("etag") &&
      recovered.data.images.length === 1,
    "album reread after conflict",
  );
  const roomAlbum = await request(roomPath + "/media", { token: admin });
  await upload(
    roomPath + "/media",
    roomAlbum.headers.get("etag"),
    "Synthetic room color bars",
  );
  const detail = (await request(hotelPath)).data;
  check(
    detail.representativeImage?.mediaId === mediaId &&
      detail.images?.length === 1,
    "detail cache reflects upload",
  );
  const card = (await request("/accommodations?status=ACTIVE&size=2")).data
    .content[0];
  const publicPath = `/media/${mediaId}/content`;
  check(
    card.images?.length === 1 &&
      card.representativeImage?.url === "/api/v1" + publicPath,
    "public card media path",
  );
  const content = await request(publicPath);
  check(
    content.type.startsWith("image/png") && content.data.byteLength > 0,
    "actual Media bytes through Vite",
  );
  console.log(
    "PASS multipart and public Media bytes, stale ETag 409 and fresh GET",
  );

  const getAvailable = async () =>
    (
      await request(
        `${hotelPath}/rooms/available?checkInDate=${first}&checkOutDate=${third}&guestCount=2`,
      )
    ).data.content;
  const available = await getAvailable();
  check(
    available[0]?.roomId === roomId &&
      available[0]?.representativeImage?.mediaId,
    "fresh availability and Room media",
  );
  const create = (
    await request("/reservations", {
      method: "POST",
      token: owner,
      expected: 201,
      body: {
        roomId,
        guestCount: 2,
        checkInDate: first,
        checkOutDate: third,
        representativeGuest: {
          name: "Fixture Guest",
          email: "guest@example.test",
          phone: "010-0000-0000",
        },
      },
    })
  ).data;
  const reservationId = id(create.reservationId);
  const reservation = "/reservations/" + reservationId;
  check(
    create.status === "CONFIRMED" &&
      create.memberId === memberIds[0] &&
      create.roomId === roomId,
    "reservation identity",
  );
  check(
    create.stayNights === 2 &&
      create.totalAmount === 26000 &&
      create.nightlyPriceSnapshot === 16000 &&
      create.nights?.map((item) => item.stayDate).join() ===
        [first, second].join(),
    "exclusive checkout and saved prices",
  );
  check(
    (await getAvailable()).length === 0,
    "availability reflects saved reservation",
  );
  check(
    (await request("/reservations?page=0&size=2", { token: owner })).data
      .content[0]?.reservationId === reservationId,
    "owner list",
  );
  await error(reservation, 403, "RESERVATION_004", { token: foreign });
  const changed = (
    await request(reservation, {
      method: "PATCH",
      token: owner,
      body: { checkInDate: second, checkOutDate: fourth },
    })
  ).data;
  check(
    changed.reservationId === reservationId &&
      changed.totalAmount === 20000 &&
      changed.checkOutDate === fourth,
    "schedule change reprices",
  );
  check(
    (await getInventory()).map((item) => item.reservedQuantity).join() ===
      "0,1,1",
    "change retains shared inventory",
  );
  const beforeCancel = businessDate();
  const cancelled = (
    await request(reservation + "/cancel", { method: "PATCH", token: owner })
  ).data;
  check(
    cancelled.status === "CANCELLED" &&
      cancelled.cancelledAt?.endsWith("Z") &&
      [beforeCancel, businessDate()].includes(cancelled.cancellationDate) &&
      cancelled.estimatedRefundAmount === 20000,
    "cancel result uses business date and UTC",
  );
  const saved = (await request(reservation, { token: owner })).data;
  check(
    saved.status === "CANCELLED" &&
      saved.refundAmount === 20000 &&
      (await getInventory()).every((item) => item.reservedQuantity === 0),
    "saved cancel and released inventory",
  );
  await request("/auth/logout", {
    method: "POST",
    token: owner,
    expected: 204,
  });
  await error("/auth/reissue", 401, "AUTH_006", {
    method: "POST",
    body: { refreshToken: ownerSession.refreshToken },
  });
  console.log(
    "PASS owner/foreign reservation, change/cancel, saved prices, inventory and logout",
  );

  let delivered = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    const rows =
      sql(`SELECT COUNT(*) FROM reservation_outbox_events o JOIN processed_reservation_events p USING (event_id)
      WHERE o.aggregate_id=${reservationId} AND o.status='PUBLISHED';`);
    if (rows === "3") {
      delivered = true;
      break;
    }
    await delay(1000);
  }
  check(
    delivered,
    "Kafka producer/consumer processed the three reservation events",
  );
  console.log(
    "PASS Kafka Outbox published and Consumer processed all three fixture events",
  );
  console.log(`Public browser routes: /accommodations and ${hotelPath}`);
  const inspectBrowserBooking = booking
    ? await (
        await import("./booking.mjs")
      ).verifyBooking({
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
        guest: foreign,
        ownerId: memberIds[0],
      })
    : undefined;
  const inspectBrowserManagement = management
    ? await (
        await import("./management.mjs")
      ).verifyManagement({
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
        ownerCredentials: users[0],
      })
    : undefined;
  if (adminVerification) {
    const { verifyAdmin } = await import("./admin.mjs");
    await verifyAdmin({
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
      ...adminVerification,
    });
  }
  return {
    accounts: users,
    memberIds,
    reservationId,
    roomId,
    inspectBrowserBooking,
    inspectBrowserManagement,
  };
}
