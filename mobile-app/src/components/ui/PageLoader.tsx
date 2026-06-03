import BrandLoader from "./BrandLoader";

/** Full-screen branded loading state (delegates to BrandLoader). */
export default function PageLoader() {
  return <BrandLoader fullScreen />;
}
