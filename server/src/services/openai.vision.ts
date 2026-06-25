export const normalizeImageUrls = (images?: unknown): string[] => {
  if (!Array.isArray(images)) {
    return [];
  }

  return images
    .map((image) => String(image || "").trim())
    .filter((image) => image.startsWith("data:image/") || /^https?:\/\//i.test(image));
};

export const buildMultimodalUserContent = (text: string, images?: unknown): string | Array<any> => {
  const normalizedImages = normalizeImageUrls(images);

  if (normalizedImages.length === 0) {
    return text;
  }

  return [
    {
      type: "text",
      text,
    },
    ...normalizedImages.map((imageUrl) => ({
      type: "image_url",
      image_url: { url: imageUrl, detail: "high" as const },
    })),
  ];
};

export const isUnsupportedImageError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error || "");
  return /unsupported image|invalid image|uploaded an unsupported image|image is valid/i.test(message);
};