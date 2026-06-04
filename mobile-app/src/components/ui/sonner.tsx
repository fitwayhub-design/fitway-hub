import { useTheme } from "@/context/ThemeContext";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * App toast host. Reads the FitWay theme (dark-first) and styles toasts with the
 * brand surface + soft shadow tokens so they match the redesigned app.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { isDark } = useTheme();

  return (
    <Sonner
      theme={isDark ? "dark" : "light"}
      className="toaster group"
      position="top-center"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--text-primary)",
          "--normal-border": "var(--border-light)",
          "--border-radius": "12px",
        } as React.CSSProperties
      }
      toastOptions={{
        style: {
          boxShadow: "var(--shadow-soft-lg)",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
