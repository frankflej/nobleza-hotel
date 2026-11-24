import type { ImageLoader } from "next/image";

/** Unsplash resizes on its own CDN, so skip the Next.js optimizer for those URLs. */
export const unsplashLoader: ImageLoader = ({ src, width, quality }) => {
  const url = new URL(src);
  url.searchParams.set("auto", "format");
  url.searchParams.set("fit", "crop");
  url.searchParams.set("w", String(width));
  url.searchParams.set("q", String(quality ?? 70));
  return url.toString();
};

export function loaderFor(src: string): ImageLoader | undefined {
  return src.startsWith("https://images.unsplash.com/") ? unsplashLoader : undefined;
}
