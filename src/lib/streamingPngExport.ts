import type Konva from "konva";

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const TILE_WIDTH = 8192;
const TILE_HEIGHT = 128;
const RGB_BYTES_PER_PIXEL = 3;
const EXPORT_PADDING = 24;

export interface PngExportBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = (crc & 1) !== 0 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

function writeUint32(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value >>> 0);
  return bytes;
}

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function createPngChunk(
  type: string,
  data: Uint8Array<ArrayBufferLike> = new Uint8Array(),
): Uint8Array<ArrayBuffer> {
  const typeBytes = new TextEncoder().encode(type);
  const payload = new Uint8Array(typeBytes.length + data.length);
  payload.set(typeBytes);
  payload.set(data, typeBytes.length);
  const chunk = new Uint8Array(12 + data.length);
  chunk.set(writeUint32(data.length), 0);
  chunk.set(payload, 4);
  chunk.set(writeUint32(crc32(payload)), 8 + data.length);
  return chunk;
}

export function createPngHeader(width: number, height: number): Uint8Array {
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  header[8] = 8;
  // Route maps are rendered on an opaque white background. RGB avoids storing
  // an alpha byte for every pixel while preserving the exact rendered colors.
  header[9] = 2;
  return header;
}

async function collectCompressedChunks(readable: ReadableStream<Uint8Array>) {
  const reader = readable.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) return chunks;
    chunks.push(value);
  }
}

function paethPredictor(left: number, up: number, upLeft: number): number {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upLeftDistance = Math.abs(estimate - upLeft);
  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) return left;
  return upDistance <= upLeftDistance ? up : upLeft;
}

function filteredByteScore(value: number): number {
  return Math.min(value, 256 - value);
}

function filterByte(
  type: number,
  value: number,
  left: number,
  up: number,
  upLeft: number,
): number {
  if (type === 1) return (value - left + 256) & 0xff;
  if (type === 2) return (value - up + 256) & 0xff;
  if (type === 3) return (value - Math.floor((left + up) / 2) + 256) & 0xff;
  if (type === 4) {
    return (value - paethPredictor(left, up, upLeft) + 256) & 0xff;
  }
  return value;
}

/** Apply the least-cost PNG filter to every packed RGB scanline. */
export function applyAdaptivePngFilters(
  rows: Uint8Array,
  width: number,
  height: number,
  previousRow?: Uint8Array,
): Uint8Array<ArrayBuffer> {
  const rowBytes = width * RGB_BYTES_PER_PIXEL;
  if (rows.length !== rowBytes * height) {
    throw new Error("The RGB scanline buffer has an invalid length.");
  }
  if (previousRow && previousRow.length !== rowBytes) {
    throw new Error("The previous PNG scanline has an invalid length.");
  }

  const filtered = new Uint8Array((rowBytes + 1) * height);
  const candidate = new Uint8Array(rowBytes);
  const best = new Uint8Array(rowBytes);
  const zeroRow = new Uint8Array(rowBytes);

  for (let rowIndex = 0; rowIndex < height; rowIndex += 1) {
    const sourceOffset = rowIndex * rowBytes;
    const outputOffset = rowIndex * (rowBytes + 1);
    const upRow =
      rowIndex === 0
        ? previousRow
        : rows.subarray(sourceOffset - rowBytes, sourceOffset);
    // Up wins immediately on repeated white/background scanlines. Trying it
    // first keeps adaptive filtering inexpensive for sparse route maps.
    const filterTypes = upRow ? [2, 4, 1, 3, 0] : [1, 0];
    let bestType = 0;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const type of filterTypes) {
      let score = 0;
      for (let index = 0; index < rowBytes; index += 1) {
        const value = rows[sourceOffset + index];
        const left = index >= RGB_BYTES_PER_PIXEL
          ? rows[sourceOffset + index - RGB_BYTES_PER_PIXEL]
          : 0;
        const up = upRow?.[index] ?? 0;
        const upLeft = index >= RGB_BYTES_PER_PIXEL
          ? upRow?.[index - RGB_BYTES_PER_PIXEL] ?? 0
          : 0;
        const filteredValue = filterByte(type, value, left, up, upLeft);
        candidate[index] = filteredValue;
        score += filteredByteScore(filteredValue);
      }
      if (score < bestScore) {
        bestScore = score;
        bestType = type;
        best.set(candidate);
        if (score === 0) break;
      }
    }

    filtered[outputOffset] = bestType;
    filtered.set(
      bestScore === 0 && bestType === 2 ? zeroRow : best,
      outputOffset + 1,
    );
  }

  if (previousRow && height > 0) {
    previousRow.set(rows.subarray(rows.length - rowBytes));
  }
  return filtered;
}

function isOpaqueWhite(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return [
    "white",
    "#fff",
    "#ffffff",
    "rgb(255,255,255)",
    "rgba(255,255,255,1)",
  ].includes(value.toLowerCase().replaceAll(" ", ""));
}

function isFullCanvasBackground(
  node: Konva.Node,
  bounds: PngExportBounds,
  stage: Konva.Stage,
): boolean {
  if (node.getClassName() !== "Rect") return false;
  const shape = node as Konva.Shape;
  const tolerance = 1;
  return isOpaqueWhite(shape.fill()) &&
    (!shape.strokeEnabled() || !shape.stroke()) &&
    bounds.x <= tolerance &&
    bounds.y <= tolerance &&
    bounds.x + bounds.width >= stage.width() - tolerance &&
    bounds.y + bounds.height >= stage.height() - tolerance;
}

function contentBounds(
  node: Konva.Node,
  stage: Konva.Stage,
): PngExportBounds | null {
  if (!node.isVisible() || node.getAbsoluteOpacity() <= 0) return null;
  const container = node as Konva.Container;
  if (typeof container.getChildren === "function") {
    let combined: PngExportBounds | null = null;
    for (const child of container.getChildren()) {
      const childBounds = contentBounds(child, stage);
      if (!childBounds) continue;
      if (!combined) {
        combined = { ...childBounds };
        continue;
      }
      const right = Math.max(
        combined.x + combined.width,
        childBounds.x + childBounds.width,
      );
      const bottom = Math.max(
        combined.y + combined.height,
        childBounds.y + childBounds.height,
      );
      combined.x = Math.min(combined.x, childBounds.x);
      combined.y = Math.min(combined.y, childBounds.y);
      combined.width = right - combined.x;
      combined.height = bottom - combined.y;
    }
    return combined;
  }

  const rect = node.getClientRect();
  const bounds = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  if (bounds.width <= 0 || bounds.height <= 0) return null;
  return isFullCanvasBackground(node, bounds, stage) ? null : bounds;
}

/** Return the visible content rectangle, excluding a full white background. */
export function getStagePngExportBounds(
  stage: Konva.Stage,
  padding = EXPORT_PADDING,
): PngExportBounds {
  const bounds = contentBounds(stage, stage);
  if (!bounds) {
    return { x: 0, y: 0, width: stage.width(), height: stage.height() };
  }
  const left = Math.max(0, Math.floor(bounds.x - padding));
  const top = Math.max(0, Math.floor(bounds.y - padding));
  const right = Math.min(
    stage.width(),
    Math.ceil(bounds.x + bounds.width + padding),
  );
  const bottom = Math.min(
    stage.height(),
    Math.ceil(bounds.y + bounds.height + padding),
  );
  return {
    x: left,
    y: top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  };
}

async function fallbackPng(
  stage: Konva.Stage,
  pixelRatio: number,
  bounds: PngExportBounds,
): Promise<Blob> {
  const canvas = stage.toCanvas({ ...bounds, pixelRatio });
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  canvas.width = 1;
  canvas.height = 1;
  if (!blob) throw new Error("The browser could not encode the line map as PNG.");
  return blob;
}

/**
 * Render and compress a PNG in narrow bands. This avoids allocating one huge
 * export canvas and a second Base64 copy for XXL line maps.
 */
export async function exportStageToStreamingPng(
  stage: Konva.Stage,
  pixelRatio: number,
): Promise<Blob> {
  const bounds = getStagePngExportBounds(stage);
  if (typeof CompressionStream === "undefined") {
    return fallbackPng(stage, pixelRatio, bounds);
  }

  const width = Math.max(1, Math.ceil(bounds.width * pixelRatio));
  const height = Math.max(1, Math.ceil(bounds.height * pixelRatio));
  const compression = new CompressionStream("deflate");
  const writer = compression.writable.getWriter();
  const compressedChunksPromise = collectCompressedChunks(compression.readable);
  const previousRow = new Uint8Array(width * RGB_BYTES_PER_PIXEL);
  let hasPreviousRow = false;

  try {
    for (let outputY = 0; outputY < height; outputY += TILE_HEIGHT) {
      const bandHeight = Math.min(TILE_HEIGHT, height - outputY);
      const rowBytes = width * RGB_BYTES_PER_PIXEL;
      const rows = new Uint8Array(rowBytes * bandHeight);

      for (let outputX = 0; outputX < width; outputX += TILE_WIDTH) {
        const tileWidth = Math.min(TILE_WIDTH, width - outputX);
        const canvas = stage.toCanvas({
          x: bounds.x + outputX / pixelRatio,
          y: bounds.y + outputY / pixelRatio,
          width: tileWidth / pixelRatio,
          height: bandHeight / pixelRatio,
          pixelRatio,
        });
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) throw new Error("A canvas context could not be created.");
        const pixels = context.getImageData(0, 0, tileWidth, bandHeight).data;
        for (let row = 0; row < bandHeight; row += 1) {
          const sourceStart = row * tileWidth * 4;
          let destination = row * rowBytes + outputX * RGB_BYTES_PER_PIXEL;
          for (let column = 0; column < tileWidth; column += 1) {
            const source = sourceStart + column * 4;
            const alpha = pixels[source + 3];
            if (alpha === 255) {
              rows[destination] = pixels[source];
              rows[destination + 1] = pixels[source + 1];
              rows[destination + 2] = pixels[source + 2];
            } else {
              const opacity = alpha / 255;
              rows[destination] = Math.round(
                pixels[source] * opacity + 255 * (1 - opacity),
              );
              rows[destination + 1] = Math.round(
                pixels[source + 1] * opacity + 255 * (1 - opacity),
              );
              rows[destination + 2] = Math.round(
                pixels[source + 2] * opacity + 255 * (1 - opacity),
              );
            }
            destination += RGB_BYTES_PER_PIXEL;
          }
        }
        canvas.width = 1;
        canvas.height = 1;
      }

      await writer.write(
        applyAdaptivePngFilters(
          rows,
          width,
          bandHeight,
          hasPreviousRow ? previousRow : undefined,
        ),
      );
      if (!hasPreviousRow && bandHeight > 0) {
        previousRow.set(rows.subarray(rows.length - previousRow.length));
        hasPreviousRow = true;
      }
    }

    await writer.close();
  } catch (error) {
    await writer.abort(error).catch(() => undefined);
    await compressedChunksPromise.catch(() => undefined);
    throw error;
  }

  const compressedChunks = await compressedChunksPromise;
  const pngParts = [
    PNG_SIGNATURE,
    createPngChunk("IHDR", createPngHeader(width, height)),
    ...compressedChunks.map((chunk) => createPngChunk("IDAT", chunk)),
    createPngChunk("IEND"),
  ].map((part) => Uint8Array.from(part).buffer);
  return new Blob(pngParts, { type: "image/png" });
}

export function getLineMapPngSizeOptions(width: number, height: number) {
  const labels = ["SS", "S", "M", "L", "XL", "XXL"];
  return labels.map((label, index) => {
    const multiplier = index + 1;
    return {
      label: `${Math.round(width * multiplier)} × ${Math.round(height * multiplier)} (${label})`,
      value: multiplier,
    };
  });
}
