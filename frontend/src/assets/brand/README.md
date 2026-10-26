# Home brand Hero — #253

Created 2026-10-27 with Codex's built-in `image_gen` tool (new generation,
not CLI/API fallback). Generation ID:
`exec-41f41578-aad2-4f8e-86d4-5859fcf5231d`.
No reference image, stock photograph or prototype asset was supplied/copied.

## Scope and provenance

This is an AI-generated **imaginary coastal brand mood scene**, not a photograph
of a real destination, accommodation or room. Use only as the decorative Home
Hero with the visible AI/non-listing notice. It is not listing Media, a property
record, a recommendation, or evidence of any accommodation's facilities/view.
Do not attach it to catalog records. Final user visual approval remains f0.6.0.

This record identifies how the asset was obtained; it does not claim stock-photo
licensing, exclusive copyright, identifiable-location authenticity, or legal
clearance. Reassess those requirements before external commercial reuse.
No third-party website image or prototype AI image was promoted into production.

## Delivered files

| File                   | Dimensions | Bytes   | SHA-256                                                            |
| ---------------------- | ---------- | ------- | ------------------------------------------------------------------ |
| `coast-hero-800.webp`  | 800 × 450  | 66,996  | `D3E18796ED89F9341036D9EFBA7DF698FB581FC85DCBA266B0442E1B0BD45AB0` |
| `coast-hero-1600.webp` | 1600 × 900 | 219,136 | `B6C6965F94E46480931627392A462E8437CCCFE1F00C6C952003F575BF66006E` |

The generated original was 1672 × 941 PNG. The original remains in the generation
history, not a runtime dependency or a repository asset. These two derivatives
are self-contained and versioned with the application. Existing local FFmpeg
converted the original to WebP quality 80 with slight 16:9 normalization, without
creative retouching or adding an application dependency:

```text
ffmpeg -n -i <original.png> -vf scale=800:450 -c:v libwebp -quality 80 -frames:v 1 coast-hero-800.webp
ffmpeg -n -i <original.png> -vf scale=1600:900 -c:v libwebp -quality 80 -frames:v 1 coast-hero-1600.webp
```

The Browser chooses a candidate from `srcSet`; high-DPR devices may choose the
larger file. The build hashes local assets; no external image CDN or font request
is required. See [layout and verification](../../../../docs/ui/frontend-home-a1-253.md).

## Final generation prompt

```text
Use case: photorealistic-natural. Asset type: production-bound travel BRAND HERO, not a listing photograph. Create one new original cinematic, photorealistic coastal landscape, imaginary location, in a wide 16:9 composition around 2048x1152. Calm deep navy sea and distant hazy headlands fill the LEFT half, clean low-detail negative space for large white website copy. On the RIGHT third, warm ivory natural rock cliffs and restrained coastal grasses catch soft late-afternoon sunlight. Elevated shoreline viewpoint, realistic water texture, subtle atmospheric depth, editorial travel photography feel, generous horizon and breathing room, understated Navy & Ivory palette. Mobile center-right crop should still show coastline and sea. NO hotels, buildings, rooms, pools, beds, people, identifiable landmarks, logos, letters, text, watermarks, UI, collage or frames. This is a new AI-generated brand mood scene; it will be visibly identified as AI-generated in the website and never attached to a property record. Do not recreate the repository prototype images.
```
