# THUMBNAIL_MULTI_RIGHT rendering implementation

The C5 rasterizer lives in `src/core/thumbnail-multi-right.ts` and is invoked through the
agent-independent Integration Adapter. It decodes each resolved PNG/JPEG with explicit EXIF
orientation handling, maps the normalized Crop to source pixels with floor/ceil bounds, uses
COVER scaling with the frozen 172×172 destination, crops according to the Plan anchor, and
applies an independent 12px rounded mask for each Slot.

The Canvas starts transparent, composites `IMAGE_PRIMARY` before `IMAGE_SECONDARY`, then draws
the existing Spoqa text. No guide, gray placeholder, or `Image` label is rasterized. The adapter
validates every referenced Asset and Plan before invoking the renderer and rejects any output
whose placement set is not exactly the two Template slots.
