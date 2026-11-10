import assert from "node:assert/strict";

// Additional fixtures belong only to run.mjs's fresh database. Keep the core smoke catalog unchanged.
export async function verifyLocations({
  request,
  error,
  check,
  id,
  sql,
  admin,
  hotel,
  businessDate,
}) {
  const active = "ACTIVE";
  const kr = hotel.country;
  const seoul = hotel.city;
  const busan = "부산광역시";
  const gangnam = "강남구";
  const haeundae = "해운대구";
  const list = async (params, token) =>
    (await request(`/accommodations?${new URLSearchParams(params)}`, { token }))
      .data;
  const ids = (page) => page.content.map((row) => id(row.accommodationId));
  // Other optional checks may already have added hotels in the original smoke location.
  const baseline = await list({ country: kr, city: seoul, status: active });
  check(
    baseline.totalElements > 0 &&
      baseline.last &&
      baseline.content.every((row) => row.region === hotel.region),
    "existing smoke catalog has one structured location",
  );
  const originalSeoul = ids(baseline);
  const makeHotel = async (name, city, region, country = kr) =>
    id(
      (
        await request("/accommodations", {
          method: "POST",
          token: admin,
          expected: 201,
          body: { ...hotel, name, city, region, country },
        })
      ).data.accommodationId,
    );
  const first = await makeHotel("Location Seoul A", seoul, gangnam);
  const duplicate = await makeHotel("Location Seoul B", seoul, gangnam);
  const coast = await makeHotel("Location Busan", busan, haeundae);
  const otherCity = await makeHotel(
    "Location Same Region",
    "테스트시",
    gangnam,
  );
  const otherCountry = await makeHotel(
    "Location Same City",
    "서울특별시",
    gangnam,
    "테스트국",
  );
  const inactive = await makeHotel("Location Hidden", seoul, "숨은지역");
  await request(`/accommodations/${inactive}/status`, {
    method: "PATCH",
    token: admin,
    body: { status: "INACTIVE" },
  });

  // The current write API requires structured values; only these two fixture rows use legacy NULLs.
  const legacy = sql(`INSERT INTO accommodations
    (name, description, country, city, region, address, status, time_zone) VALUES
    ('Location Legacy', 'Test only', NULL, NULL, NULL, '서울특별시 강남구', 'ACTIVE', 'Asia/Seoul'),
    ('Location Partial', 'Test only', '대한민국', '서울특별시', NULL, '서울특별시 강남구', 'ACTIVE', 'Asia/Seoul');
    SELECT id FROM accommodations WHERE name IN ('Location Legacy', 'Location Partial') ORDER BY id;`)
    .split(/\s+/)
    .map((value) => id(Number(value)));
  check(legacy.length === 2, "two isolated legacy location rows");
  const extra = Array.from(
    { length: 12 },
    (_, index) =>
      `('Location Limit ${index}', 'Test only', '대한민국', '상한테스트시', '한도 ${String(index).padStart(2, "0")}', 'Test only', 'ACTIVE', 'Asia/Seoul')`,
  );
  sql(`INSERT INTO accommodations
    (name, description, country, city, region, address, status, time_zone) VALUES ${extra.join(",")};`);

  const options = async (q) =>
    (
      await request(
        `/accommodations/locations/suggestions?${new URLSearchParams({ q })}`,
      )
    ).data;
  const sorted = (values) => values.toSorted((a, b) => a - b);
  const equal = (actual, expected, label) => {
    try {
      assert.deepEqual(actual, expected);
    } catch {
      check(false, label);
    }
  };
  const only = (page, expected, label) =>
    equal(sorted(ids(page)), sorted(expected), label);

  for (const [destination, expected] of [
    ["서울", [...originalSeoul, first, duplicate, otherCountry, legacy[1]]],
    [
      "서울특별시",
      [...originalSeoul, first, duplicate, otherCountry, legacy[1]],
    ],
    ["부산", [coast]],
    ["강남", [first, duplicate, otherCity, otherCountry]],
    ["해운대", [coast]],
    [" 서울\u00a0  강남 ", [first, duplicate, otherCountry]],
    ["없는지역", []],
  ])
    only(
      await list({ destination, status: active }),
      expected,
      "free destination fixture IDs",
    );
  const cities = await options("서울특별시");
  equal(
    cities.map(({ type }) => type),
    ["CITY", "CITY", "REGION", "REGION", "REGION"],
    "exact city ranks before its child regions",
  );
  equal(
    await options("서울"),
    cities,
    "partial city yields the same ordered city and child options",
  );
  const seoulCity = cities.find(
    (row) => row.type === "CITY" && row.searchParams.country === kr,
  );
  only(
    await list(seoulCity.searchParams),
    [...originalSeoul, first, duplicate, legacy[1]],
    "city candidate exact return",
  );
  const matches = await options("강남");
  equal(
    matches.length,
    3,
    "duplicate region removed; same-named regions remain distinct",
  );
  const selected = matches.find(
    ({ searchParams }) =>
      searchParams.city === seoul && searchParams.country === kr,
  );
  for (const option of matches) {
    const params = option.searchParams;
    const expected =
      params.country !== kr
        ? [otherCountry]
        : params.city === seoul
          ? [first, duplicate]
          : [otherCity];
    equal(
      option.displayName,
      gangnam,
      "region label comes from its persisted region",
    );
    only(
      await list(params),
      expected,
      "round-trip each same-named region without legacy fallback",
    );
  }
  for (const q of ["부산", "해운대", "서울 강남"]) {
    const candidates = await options(q);
    check(
      candidates.some(({ type }) => type === "REGION"),
      "fixture-specific region suggestion",
    );
    for (const { searchParams } of candidates) {
      const expected =
        q === "서울 강남"
          ? searchParams.country === kr
            ? [first, duplicate]
            : [otherCountry]
          : [coast];
      only(
        await list(searchParams),
        expected,
        "fixture-specific candidate return",
      );
    }
  }
  for (const q of ["", " 서 ", "없는지역", "숨은지역"])
    equal(
      await options(q),
      [],
      "empty, short, missing or inactive-only candidate",
    );
  await error(
    `/accommodations/locations/suggestions?q=${"a".repeat(101)}`,
    400,
    "COMMON_001",
  );
  equal(
    (await options("한도")).map(({ displayName }) => displayName),
    Array.from(
      { length: 10 },
      (_, index) => `한도 ${String(index).padStart(2, "0")}`,
    ),
    "stable capped candidates",
  );
  only(
    await list({ city: seoul, region: gangnam, status: active }, admin),
    [first, duplicate, otherCountry, legacy[1]],
    "legacy admin exact filter retains NULL-region fallback",
  );

  const room = (
    await request(`/accommodations/${first}/rooms`, {
      method: "POST",
      token: admin,
      expected: 201,
      body: {
        name: "Location Seoul Room",
        capacity: 2,
        nightlyPrice: 10000,
        amenities: ["WIFI"],
      },
    })
  ).data;
  const roomId = id(room.roomId);
  const [checkInDate, second, checkOutDate] = [36, 37, 38].map(businessDate);
  for (const inventoryDate of [checkInDate, second]) {
    await request(`/rooms/${roomId}/inventories`, {
      method: "POST",
      token: admin,
      expected: 201,
      body: { inventoryDate, totalQuantity: 1 },
    });
  }
  const stay = { checkInDate, checkOutDate, guestCount: "2" };
  only(
    await list({
      ...selected.searchParams,
      ...stay,
      roomAmenities: "WIFI",
      sortBy: "NAME",
      direction: "DESC",
    }),
    [first],
    "selected region plus date, guests, amenities and sort",
  );
  only(
    await list({ ...selected.searchParams, ...stay, guestCount: "3" }),
    [],
    "selected region insufficient room capacity",
  );
  const available = (
    await request(
      `/accommodations/${first}/rooms/available?${new URLSearchParams(stay)}`,
    )
  ).data;
  equal(
    available.content.map((item) => item.roomId),
    [roomId],
    "availability matches selected region stay",
  );
  const page = await list({
    ...selected.searchParams,
    page: "1",
    size: "1",
    sortBy: "NAME",
    direction: "DESC",
  });
  check(
    page.totalElements === 2 && page.page === 1 && page.last,
    "selected region pagination metadata",
  );
  only(page, [first], "selected region stable result order on page two");
  console.log(
    "PASS location search keywords, exact candidate round-trips, dedup/order/cap, legacy and dated availability",
  );
  console.log(
    `Location browser fixture: ${new URLSearchParams(stay)}; detail /accommodations/${first}`,
  );
}
