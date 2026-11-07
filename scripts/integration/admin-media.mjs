export async function verifyAdminAlbums({
  request,
  read,
  error,
  check,
  id,
  sql,
  picture,
  admin,
  mediaFiles,
  albums,
}) {
  const baseline = mediaFiles().join();
  const readAlbum = async (path, ownerId, ownerType) => {
    const { data, headers } = await request(path, { token: admin });
    const revision = headers.get("etag");
    check(
      data.ownerId === ownerId &&
        data.ownerType === ownerType &&
        /^[a-f0-9]{64}$/.test(data.revision) &&
        revision === `"${data.revision}"`,
      "ADMIN album scope and strong ETag",
    );
    return { revision, images: data.images };
  };
  const content = (mediaId) => "/media/" + id(mediaId) + "/content";
  const metadata = (altText) => ({
    altText,
    source: "Generated color bars",
    rightsRecord: "Synthetic fixture",
  });
  const imageForm = (altText, bytes = picture) => {
    const form = new FormData();
    form.append(
      "file",
      new Blob([bytes], { type: "image/png" }),
      "fixture.png",
    );
    form.append(
      "metadata",
      new Blob([JSON.stringify(metadata(altText))], {
        type: "application/json",
      }),
    );
    return form;
  };
  const mutation = (method, revision, body, expected = 200) => ({
    method,
    token: admin,
    body,
    expected,
    headers: { "If-Match": revision },
  });
  for (const [ownerPath, ownerId, ownerType] of albums) {
    const albumPath = ownerPath + "/media";
    const album = () => readAlbum(albumPath, ownerId, ownerType);
    const ids = (current) =>
      current.images.map((item) => id(item.image.mediaId));
    const publicOrder = async (expected) => {
      const result = await read(ownerPath);
      check(
        result.images.map((image) => image.mediaId).join() ===
          expected.join() &&
          (result.representativeImage?.mediaId ?? null) ===
            (expected[0] ?? null) &&
          result.images.every(
            (image) => !("rightsRecord" in image) && !("source" in image),
          ),
        "warm public detail cache reflects album writes without ADMIN metadata",
      );
    };
    const original = await album();
    check(original.images.length === 0, "new fixture album is empty");
    await publicOrder([]);
    await error(
      albumPath,
      400,
      "MEDIA_003",
      mutation(
        "POST",
        original.revision,
        imageForm("Invalid PNG", new Uint8Array([1, 2, 3])),
      ),
    );
    const empty = await album();
    check(
      empty.revision === original.revision &&
        empty.images.length === 0 &&
        mediaFiles().join() === baseline,
      "invalid image leaves album and storage unchanged",
    );

    await request(
      albumPath,
      mutation("POST", empty.revision, imageForm("First fixture"), 201),
    );
    const one = await album();
    const [first] = ids(one);
    check(one.images.length === 1 && id(first), "first upload persisted");
    await publicOrder([first]);
    await request(
      albumPath,
      mutation("POST", one.revision, imageForm("Second fixture"), 201),
    );
    const two = await album();
    const [, second] = ids(two);
    check(two.images.length === 2 && id(second), "second upload appended");
    const imagePath = albumPath + "/" + second;
    await error(
      imagePath + "/representative",
      409,
      "MEDIA_005",
      mutation("PATCH", one.revision),
    );
    const recovered = await album();
    check(
      recovered.revision === two.revision &&
        ids(recovered).join() === [first, second].join(),
      "stale write leaves order unchanged; recovery reads latest revision",
    );
    await request(
      imagePath,
      mutation("PUT", recovered.revision, metadata("Reviewed fixture")),
    );
    const edited = await album();
    check(
      edited.images[1]?.image.altText === "Reviewed fixture" &&
        edited.images[1]?.rightsRecord === "Synthetic fixture" &&
        (await read(ownerPath)).images[1]?.altText === "Reviewed fixture",
      "metadata is stored and updated in public cache",
    );
    await request(
      imagePath + "/representative",
      mutation("PATCH", edited.revision),
    );
    const representative = await album();
    check(
      ids(representative).join() === [second, first].join(),
      "representative operation moves image first",
    );
    await publicOrder([second, first]);
    await request(
      albumPath + "/order",
      mutation("PUT", representative.revision, { mediaIds: [first, second] }),
    );
    const reordered = await album();
    check(
      ids(reordered).join() === [first, second].join(),
      "explicit order is persisted",
    );
    await publicOrder([first, second]);

    await request(
      albumPath + "/" + first + "/content",
      mutation("PUT", reordered.revision, imageForm("Replacement fixture")),
    );
    const replaced = await album();
    const [replacement, kept] = ids(replaced);
    check(
      replacement !== first && id(replacement) && kept === second,
      "replacement creates a new ID in the same position",
    );
    await publicOrder([replacement, second]);
    const bytes = await request(content(replacement));
    check(
      bytes.type.startsWith("image/png") && bytes.data.byteLength > 0,
      "new public image serves actual bytes",
    );
    await error(content(first), 404, "MEDIA_001");

    await request(
      albumPath + "/" + replacement,
      mutation("DELETE", replaced.revision),
    );
    const remaining = await album();
    check(
      ids(remaining).join() === String(second),
      "deleting representative leaves the next image",
    );
    await publicOrder([second]);
    await error(content(replacement), 404, "MEDIA_001");
    await request(imagePath, mutation("DELETE", remaining.revision));
    check(
      (await album()).images.length === 0,
      "all added images deleted from album",
    );
    await publicOrder([]);
    await error(content(second), 404, "MEDIA_001");

    const { data: cleanup } = await request("/admin/media/cleanup", {
      method: "POST",
      token: admin,
      body: { acknowledged: true },
    });
    const column = ownerType === "ROOM" ? "room_id" : "accommodation_id";
    check(
      cleanup.failed === 0 &&
        sql(
          `SELECT COUNT(*) FROM catalog_media WHERE ${column}=${id(ownerId)};`,
        ) === "0" &&
        sql("SELECT COUNT(*) FROM media_file_cleanup;") === "0" &&
        mediaFiles().join() === baseline,
      "explicit cleanup restores original isolated file set and clears obsolete rows",
    );
    console.log(
      `PASS ${ownerType} album revision/recovery, public cache, replacement/deletion and file cleanup`,
    );
  }
}
