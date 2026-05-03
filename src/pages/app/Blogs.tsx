import BlogExperience from "@/components/app/BlogExperience";
import { useI18n } from "@/context/I18nContext";

export default function AppBlogs() {
  const { lang } = useI18n();
  return (
    <BlogExperience
      mode="app"
      heading={lang === "ar" ? "مافيش تعب مافيش شاورما" : "No Pain No Shawerma"}
      subheading="Read focused fitness content without leaving your training workspace."
      allowWriting
    />
  );
}
