import { useEffect, useMemo, useRef, useState } from "react";
import { Image as KonvaImage, Layer } from "react-konva";
import Konva from "konva";
import { useImageStore, type ImageEntry } from "@/db/useImageStore";
import type { SignImagePlacement } from "@/customization/signImages";
import { useCustomSignDefinition } from "./CustomSignText";

export interface ResolvedSignImage {
  placement: SignImagePlacement;
  image: HTMLImageElement;
}

const EMPTY_PLACEMENTS: readonly SignImagePlacement[] = [];
const EMPTY_IMAGE_MAP: ReadonlyMap<string, HTMLImageElement> = new Map();
const EMPTY_IMAGE_ENTRIES: readonly ImageEntry[] = [];

/** Wait until the currently mounted stage can include its uploaded images. */
export function waitForSignImages(
  getStage: () => Konva.Stage | null,
  timeoutMs = 10_000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    let settled = false;

    const poll = () => {
      if (settled) return;

      const stage = getStage();
      const imageLayer = stage?.findOne<Konva.Layer>(".sign-images");
      if (
        stage &&
        imageLayer?.getAttr("signImagesReady") === true
      ) {
        settled = true;
        stage.draw();
        resolve();
        return;
      }

      if (Date.now() >= deadline) {
        settled = true;
        reject(new Error("Timed out waiting for station sign images to load"));
        return;
      }

      requestAnimationFrame(poll);
    };

    requestAnimationFrame(poll);
  });
}

/** Load uploaded images for a sign, while honoring an explicit empty override. */
export function useSignImages(
  placements?: readonly SignImagePlacement[],
): { images: ResolvedSignImage[]; ready: boolean } {
  const definition = useCustomSignDefinition();
  const effectivePlacements = placements ?? definition?.images ?? EMPTY_PLACEMENTS;
  const { images, loading } = useImageStore();
  const referencedImageIds = Array.from(
    new Set(effectivePlacements.map((placement) => placement.imageId)),
  ).sort();
  const referencedImageIdsSignature = JSON.stringify(referencedImageIds);
  const referencedImageIdsRef = useRef(referencedImageIds);
  referencedImageIdsRef.current = referencedImageIds;
  const sourceEntries = useMemo(() => {
    const ids = new Set(referencedImageIdsRef.current);
    return images.filter((entry) => ids.has(entry.id));
  }, [images, referencedImageIdsSignature]);
  const [loaded, setLoaded] = useState<{
    sources: readonly ImageEntry[];
    imagesById: ReadonlyMap<string, HTMLImageElement>;
  }>({ sources: EMPTY_IMAGE_ENTRIES, imagesById: EMPTY_IMAGE_MAP });

  useEffect(() => {
    let cancelled = false;

    if (sourceEntries.length === 0) {
      setLoaded({ sources: sourceEntries, imagesById: EMPTY_IMAGE_MAP });
      return () => {
        cancelled = true;
      };
    }

    Promise.all(
      sourceEntries.map(
        (entry) =>
          new Promise<{ id: string; image: HTMLImageElement } | null>(
            (resolve) => {
              const image = new Image();
              image.onload = () => resolve({ id: entry.id, image });
              image.onerror = () => resolve(null);
              image.src = entry.objectUrl;
              if (image.complete && image.naturalWidth > 0) {
                resolve({ id: entry.id, image });
              }
            },
          ),
      ),
    ).then((results) => {
      if (!cancelled) {
        setLoaded({
          sources: sourceEntries,
          imagesById: new Map(
            results
              .filter(
                (result): result is { id: string; image: HTMLImageElement } =>
                  result !== null,
              )
              .map(({ id, image }) => [id, image] as const),
          ),
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [sourceEntries]);

  const loadedImagesById =
    loaded.sources === sourceEntries ? loaded.imagesById : EMPTY_IMAGE_MAP;
  const resolvedImages = useMemo(
    () =>
      effectivePlacements.flatMap((placement) => {
        const image = loadedImagesById.get(placement.imageId);
        return image ? [{ placement, image }] : [];
      }),
    [effectivePlacements, loadedImagesById],
  );
  const ready = !loading && loaded.sources === sourceEntries;
  return useMemo(() => ({ images: resolvedImages, ready }), [resolvedImages, ready]);
}

export function SignImageLayer({
  images,
  ready,
}: {
  images: readonly ResolvedSignImage[];
  ready: boolean;
}) {
  return (
    <Layer
      name="sign-images"
      signImagesReady={ready}
      listening={false}
    >
      {images.map(({ placement, image }) => (
        <KonvaImage
          key={placement.id}
          image={image}
          x={placement.x + placement.width / 2}
          y={placement.y + placement.height / 2}
          width={placement.width}
          height={placement.height}
          offsetX={placement.width / 2}
          offsetY={placement.height / 2}
          rotation={placement.rotation}
          opacity={placement.opacity}
          listening={false}
          perfectDrawEnabled={false}
        />
      ))}
    </Layer>
  );
}
