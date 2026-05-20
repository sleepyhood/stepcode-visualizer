export type LocalPoint = { x: number; y: number };

export type LocalRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ArtboardBounds = {
  width: number;
  height: number;
  padding: number;
};

export type ExportFrameInput = {
  artboard: LocalRect;
  overlays: LocalRect[];
  padding: number;
};

export function getLocalPoint(
  origin: { left: number; top: number },
  point: { left: number; top: number },
): LocalPoint {
  return {
    x: point.left - origin.left,
    y: point.top - origin.top,
  };
}

export function clampToArtboard(
  rect: LocalRect,
  artboard: ArtboardBounds,
): LocalRect {
  const min = artboard.padding;
  const maxWidth = Math.max(0, artboard.width - artboard.padding * 2);
  const maxHeight = Math.max(0, artboard.height - artboard.padding * 2);
  const width = Math.min(rect.width, maxWidth);
  const height = Math.min(rect.height, maxHeight);
  const maxX = Math.max(min, artboard.width - artboard.padding - width);
  const maxY = Math.max(min, artboard.height - artboard.padding - height);

  return {
    ...rect,
    width,
    height,
    x: Math.min(Math.max(rect.x, min), maxX),
    y: Math.min(Math.max(rect.y, min), maxY),
  };
}

export function getSafeExportFrame(input: ExportFrameInput): LocalRect {
  const all = [input.artboard, ...input.overlays];
  const left = Math.min(...all.map((item) => item.x)) - input.padding;
  const top = Math.min(...all.map((item) => item.y)) - input.padding;
  const right = Math.max(...all.map((item) => item.x + item.width)) + input.padding;
  const bottom = Math.max(...all.map((item) => item.y + item.height)) + input.padding;

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}
