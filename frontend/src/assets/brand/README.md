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
The room concept remains reference/Audit-only.
