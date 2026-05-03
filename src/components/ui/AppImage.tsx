import { CSSProperties, ReactNode } from "react";
import { useAppImage } from "@/context/AppImagesContext";

type Props = {
  slug: string;
  alt?: string;
  fallback?: ReactNode;
  style?: CSSProperties;
  className?: string;
  loading?: "lazy" | "eager";
};

/** Renders an admin-uploaded image by slug, with an optional fallback node while absent. */
export default function AppImage({ slug, alt, fallback = null, style, className, loading = "lazy" }: Props) {
  const img = useAppImage(slug);
  if (!img?.url) return <>{fallback}</>;
  return (
    <img
      src={img.url}
      alt={alt ?? img.alt ?? slug}
      style={style}
      className={className}
      loading={loading}
      draggable={false}
    />
  );
}
