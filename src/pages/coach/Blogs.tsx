import BlogExperience from "@/components/app/BlogExperience";
import { useI18n } from "@/context/I18nContext";

export default function CoachBlogs() {
  const { lang } = useI18n();
  return (
    <BlogExperience
      mode="coach"
      heading={lang === "ar" ? "مافيش تعب مافيش شاورما" : "No Pain No Shawerma"}
      subheading="Write, upload media, and publish expert stories for your athletes and the public."
      allowWriting
    />
  );
}
