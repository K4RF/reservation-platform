# Home brand Hero

## Current Home A1 — #277

#277 explicitly permits promoting a reference asset after recording its changed
purpose. Home now uses two WebP derivatives of the repository's
`docs/ui/prototypes/premium-travel/assets/coast-concept.png`: the fictional sea,
architecture and warm-light composition, not the former building-free cliff.
The original was created 2026-10-22 with built-in ImageGen, generation ID
`exec-de9d8c38-b052-441e-a1bc-2c77d3e7f98b`. Its prompt and provenance remain in
[prototype ASSETS.md](../../../../docs/ui/prototypes/premium-travel/ASSETS.md).
No new generation, external photograph or creative retouching was performed.

Use is limited to a **decorative brand Hero**, with one visible AI/non-listing
notice. It is not an actual property, destination, recommendation or evidence of
facilities/views. Never upload/attach these files to Accommodation/Room Media.
The real Home exploration cards use only the Backend's representativeImage.
The source record does not assert an exclusive copyright, stock-photo license or
legal clearance; reassess rights before external commercial reuse. Final user
visual approval remains f0.6.0, not implied by this implementation.

| File                | Dimensions | Bytes   | SHA-256                                                            |
| ------------------- | ---------- | ------- | ------------------------------------------------------------------ |
| `home-a1-800.webp`  | 800 × 450  | 52,228  | `E3DB05250B0BAFEB88173B017CA1E52FF3CB931802AE81AB6188E13116A517C3` |
| `home-a1-1600.webp` | 1600 × 900 | 153,676 | `C07FA2CACDCAD5D07D2D302F4ED32384F95DB3577FB1D26B1E50C43B54E5E69B` |

Source: 1672 × 941 PNG, 2,456,556 bytes, SHA-256
`069E233AD1276FEA1234423F7330BD92ABE51B9E0AF6CBA1F6C1A6F1F9C33359`.
Existing FFmpeg 8.1.2 mechanically resized/encoded it on 2026-11-03; no application
dependency, network CDN, real catalog write or production runtime source lookup:

```text
ffmpeg -n -i docs/ui/prototypes/premium-travel/assets/coast-concept.png -vf scale=800:450 -c:v libwebp -quality 80 -frames:v 1 frontend/src/assets/brand/home-a1-800.webp
ffmpeg -n -i docs/ui/prototypes/premium-travel/assets/coast-concept.png -vf scale=1600:900 -c:v libwebp -quality 80 -frames:v 1 frontend/src/assets/brand/home-a1-1600.webp
```

The Browser selects 800w/1600w using srcSet; Vite hashes self-contained local files.
The room concept remains reference/Audit-only. See
[layout, comparison and verification](../../../../docs/ui/frontend-home-rebuild-277.md).

## Historical Home brand Hero — #253

The following records the former #253 building-free scene. It is retained for
historical evidence, but is no longer imported by Home or included in its bundle.

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
At #253, no third-party website image or prototype AI image was promoted into
production. The later #277 decorative-brand exception is recorded above.

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
