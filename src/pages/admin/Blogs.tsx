import BlogExperience from "@/components/app/BlogExperience";
import { useI18n } from "@/context/I18nContext";

export default function AdminBlogs() {
  const { lang } = useI18n();
  return (
    <BlogExperience
      mode="admin"
      heading={lang === "ar" ? "مدونتنا" : "Our Blog"}
      subheading="Manage platform articles, publish announcements, and curate long-form content."
      allowWriting
    />
  );
}
