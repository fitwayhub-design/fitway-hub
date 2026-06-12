import BlogExperience from "@/components/app/BlogExperience";
import { useI18n } from "@/context/I18nContext";
import { usePageTitle } from "@/lib/usePageMeta";

export default function WebsiteBlogs() {
  const { t } = useI18n();
  usePageTitle("Blog — FitWay Hub");

  return (
    <BlogExperience
      mode="website"
      heading={t("blog_title")}
      subheading={t("blog_subheading")}
    />
  );
}
