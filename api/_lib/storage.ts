import { get, list, put } from "@vercel/blob";

export async function writePrivateJson(pathname: string, value: unknown): Promise<void> {
  await put(pathname, JSON.stringify(value), {
    access: "private",
    allowOverwrite: true,
    addRandomSuffix: false,
    contentType: "application/json",
    cacheControlMaxAge: 60,
  });
}

export async function readPrivateJson<T>(pathname: string): Promise<T | null> {
  const result = await get(pathname, { access: "private", useCache: false });
  if (!result) return null;
  return JSON.parse(await new Response(result.stream).text()) as T;
}

export async function readPrivateText(pathname: string): Promise<{ text: string; uploadedAt: Date } | null> {
  const result = await get(pathname, { access: "private", useCache: false });
  if (!result) return null;
  return { text: await new Response(result.stream).text(), uploadedAt: result.blob.uploadedAt };
}

export async function writePrivateText(pathname: string, text: string): Promise<void> {
  await put(pathname, text, {
    access: "private",
    allowOverwrite: true,
    addRandomSuffix: false,
    contentType: "application/octet-stream",
    cacheControlMaxAge: 60,
  });
}

export async function listPrivateBlobs(prefix: string): Promise<string[]> {
  const paths: string[] = [];
  let cursor: string | undefined;
  do {
    const result = await list({ prefix, limit: 1000, ...(cursor ? { cursor } : {}) });
    paths.push(...result.blobs.map((blob) => blob.pathname));
    cursor = result.hasMore ? result.cursor : undefined;
  } while (cursor);
  return paths;
}
