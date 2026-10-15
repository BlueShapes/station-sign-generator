import { describe, expect, test } from "bun:test";
import {
  createSignImagePlacement, normalizeSignImages, normalizeRouteSignImages,
  routeSignImageKey, MAX_SIGN_IMAGES,
} from "../src/customization/signImages";
import { createCustomDefinition, duplicateCustomSignDefinition, updateCustomSignDefinition } from "../src/customization/model";
import { sanitizeDirectInputData } from "../src/lib/textInputSafety";
import { DEFAULT_DATA } from "../src/db/seed";

describe("station-sign images", () => {
  test("starts at the upper left with bounded size and the image's aspect ratio", () => {
    const landscape = createSignImagePlacement({ id: "uploaded", width: 300, height: 150 });
    expect(landscape).toMatchObject({ imageId: "uploaded", x: 0, y: 0, width: 40, height: 20, rotation: 0, opacity: 1 });
    expect(createSignImagePlacement({ id: "portrait", width: 100, height: 200 })).toMatchObject({ width: 20, height: 40 });
    expect(createSignImagePlacement({ id: "uploaded", width: 300, height: 150 }).id).not.toBe(landscape.id);
  });

  test("validates imported transforms and distinguishes inheritance from explicit removal", () => {
    expect(normalizeSignImages(undefined)).toBeUndefined();
    expect(normalizeSignImages({ imageId: "bad" })).toBeUndefined();
    expect(normalizeSignImages([])).toEqual([]);
    const result = normalizeSignImages([
      null, {}, { imageId: "" },
      { imageId: "a", x: NaN, y: -22, width: -1, height: Infinity, rotation: 500, opacity: -2 },
      { imageId: "b", id: "same" }, { imageId: "b", id: "same" },
    ]);
    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({ x: 0, y: -22, width: 0.1, height: 40, rotation: 360, opacity: 0 });
    expect(new Set(result.map(({ id }) => id)).size).toBe(3);
    expect(normalizeSignImages(Array.from({ length: 100 }, () => ({ imageId: "a" })))).toHaveLength(MAX_SIGN_IMAGES);
  });

  test("copies custom style images independently and preserves IDs when editing", () => {
    const images = [createSignImagePlacement({ id: "asset", width: 20, height: 10 })];
    const original = createCustomDefinition("sign", "Custom", "jreast", { images });
    images[0].x = 200;
    expect(original.images[0].x).toBe(0);
    const copy = duplicateCustomSignDefinition(original, "Copy");
    copy.images[0].x = 100;
    expect(original.images[0].x).toBe(0);
    const edited = updateCustomSignDefinition(original, { name: "Edited", templateId: "jrwest", layout: {}, images: copy.images });
    expect(edited.id).toBe(original.id);
    expect(edited.images[0].x).toBe(100);
    expect(edited.images).not.toBe(copy.images);
    expect(sanitizeDirectInputData({ ...DEFAULT_DATA, images: copy.images }).images).toEqual(copy.images);
    expect(sanitizeDirectInputData({ ...DEFAULT_DATA, images: [] }).images).toEqual([]);
  });

  test("keeps each route/station/style independent, including explicit empty overrides", () => {
    const key = routeSignImageKey("line-a", "station-a", "jreast");
    expect(key).not.toBe(routeSignImageKey("line-b", "station-a", "jreast"));
    expect(key).not.toBe(routeSignImageKey("line-a", "station-b", "jreast"));
    expect(key).not.toBe(routeSignImageKey("line-a", "station-a", "jrwest"));
    expect(normalizeRouteSignImages({ [key]: [], invalid: "bad" })).toEqual({ [key]: [] });
    expect(normalizeRouteSignImages(null)).toEqual({});
  });
});
