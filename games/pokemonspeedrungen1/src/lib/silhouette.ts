async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

function toSilhouetteDataUrl(image: HTMLImageElement): string {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;

  const context = canvas.getContext("2d");
  if (!context) {
    return image.src;
  }

  context.drawImage(image, 0, 0);
  const data = context.getImageData(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < data.data.length; i += 4) {
    const alpha = data.data[i + 3];
    if (alpha > 0) {
      data.data[i] = 0;
      data.data[i + 1] = 0;
      data.data[i + 2] = 0;
    }
  }

  context.putImageData(data, 0, 0);
  return canvas.toDataURL("image/png");
}

export async function getSilhouetteForId(
  id: number,
  src: string,
  cache: Map<number, string>,
): Promise<string> {
  const cached = cache.get(id);
  if (cached) {
    return cached;
  }

  const image = await loadImage(src);
  const silhouette = toSilhouetteDataUrl(image);
  cache.set(id, silhouette);
  return silhouette;
}
