import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { getApiBase } from "@/lib/api";

type AppImage = { url: string; alt: string | null; category: string | null };
type ImagesMap = Record<string, AppImage>;

type Ctx = {
  images: ImagesMap;
  isReady: boolean;
  get: (slug: string) => AppImage | undefined;
  refresh: () => Promise<void>;
};

const AppImagesCtx = createContext<Ctx>({
  images: {},
  isReady: false,
  get: () => undefined,
  refresh: async () => {},
});

export function AppImagesProvider({ children }: { children: ReactNode }) {
  const [images, setImages] = useState<ImagesMap>({});
  const [isReady, setIsReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${getApiBase()}/api/app-images`);
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setImages(data.images || {});
    } catch {
      setImages({});
    } finally {
      setIsReady(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const get = useCallback((slug: string) => images[slug], [images]);

  return (
    <AppImagesCtx.Provider value={{ images, isReady, get, refresh }}>
      {children}
    </AppImagesCtx.Provider>
  );
}

export function useAppImages() {
  return useContext(AppImagesCtx);
}

export function useAppImage(slug: string) {
  const { get } = useAppImages();
  return get(slug);
}
