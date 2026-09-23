// Custom VitePress theme — extends the default theme with FeedbackKit branding
// to match the web dashboard's neutral/monochrome design language.
import DefaultTheme from "vitepress/theme";
import type { Theme } from "vitepress";
import "./custom.css";

export default {
  extends: DefaultTheme,
} satisfies Theme;
