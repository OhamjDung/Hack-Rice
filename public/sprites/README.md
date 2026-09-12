# CashBound source sprites

Extracted from the user-supplied image_3.jpg with deterministic cropping and transparency masks. Native PNGs preserve the source resolution; @4x PNGs use nearest-neighbor enlargement and add no invented detail. The room base reuses image_4.jpg wall strips, floor texture, perimeter and ambient shadow. keys-pedestal uses image_5.png.

Run `node scripts/extract-room-sprites.mjs` to reproduce. Crop coordinates and provenance are recorded in manifest.json. Single-view artwork supports a fixed isometric camera with pan and zoom. Hidden surfaces and occluded pixels are not synthesized.
