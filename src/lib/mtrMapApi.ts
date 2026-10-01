import { MTR_JSON_MAX_BYTES, MtrImportError, parseMtrJson, type MtrMap, type MtrVersion } from "./mtrImport";

export const MTR_FETCH_TIMEOUT_MS = 15_000;
const MODERN_PATH = "mtr/api/map/stations-and-routes";

export function getMtrApiUrl(input: string, version: MtrVersion, dimension: number): string {
  if (input.length > 2048 || !Number.isSafeInteger(dimension) || dimension < 0 || dimension > 2_147_483_647) {
    throw new MtrImportError("invalid-url");
  }
  let url: URL;
  try { url = new URL(input.trim()); }
  catch { throw new MtrImportError("invalid-url"); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new MtrImportError("invalid-url");
  }
  const prefix = url.pathname.replace(/\/(?:mtr\/api\/map\/stations-and-routes|data|index\.html)\/?$/, "/");
  url.pathname = `${prefix.replace(/\/$/, "")}/${version === "3.2.2-hotfix-2" ? "data" : MODERN_PATH}`;
  url.search = "";
  // Legacy /data ignores this parameter. We use it to select the response array.
  url.searchParams.set("dimension", String(dimension));
  url.hash = "";
  return url.href;
}

async function readBoundedJson(response: Response): Promise<string> {
  if (Number(response.headers.get("content-length")) > MTR_JSON_MAX_BYTES) {
    await response.body?.cancel();
    throw new MtrImportError("too-large");
  }
  if (!response.body) throw new MtrImportError("invalid-json");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MTR_JSON_MAX_BYTES) {
        await reader.cancel();
        throw new MtrImportError("too-large");
      }
      chunks.push(decoder.decode(value, { stream: true }));
    }
    chunks.push(decoder.decode());
    return chunks.join("");
  } finally { reader.releaseLock(); }
}

export async function fetchMtrMap(url: string, version: MtrVersion, signal?: AbortSignal): Promise<MtrMap> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  let timedOut = false;
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, MTR_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "GET", credentials: "omit", referrerPolicy: "no-referrer", signal: controller.signal,
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new MtrImportError("fetch-failed");
    }
    const json = await readBoundedJson(response);
    const dimension = Number(new URL(url).searchParams.get("dimension") ?? 0);
    return parseMtrJson(json, version, dimension);
  } catch (error) {
    if (timedOut) throw new MtrImportError("timeout");
    if (error instanceof MtrImportError) throw error;
    throw new MtrImportError("fetch-failed");
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}
