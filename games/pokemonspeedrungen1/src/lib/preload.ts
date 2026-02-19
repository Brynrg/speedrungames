const imagePromiseCache = new Map<string, Promise<void>>();

export function getGen1ImageSrc(id: number): string {
  return `/games/pokemonspeedrungen1/assets/gen1/${String(id).padStart(3, "0")}.png`;
}

export function preloadImage(src: string): Promise<void> {
  const cached = imagePromiseCache.get(src);
  if (cached) {
    return cached;
  }

  const promise = new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
  });

  imagePromiseCache.set(src, promise);
  return promise;
}

export function preloadAllGen1(ids: number[]): void {
  for (const id of ids) {
    void preloadImage(getGen1ImageSrc(id));
  }
}

export async function ensureImageLoadedById(id: number): Promise<string> {
  const src = getGen1ImageSrc(id);
  await preloadImage(src);
  return src;
}
