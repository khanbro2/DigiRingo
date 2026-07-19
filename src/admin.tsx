import { createRoot } from "react-dom/client";
import AdminApp from "./admin/AdminApp";
import { THEME_VARS } from "./app/core/theme";

// The Control Hub is always dark. The shared design tokens (colors.text / muted /
// faint) resolve to CSS variables that the MAIN app injects via its ThemeProvider
// — the admin bundle has no such provider, so we inject them here and force the
// dark palette. Without this, var(--dg-text) is undefined and every piece of text
// renders black-on-black (headings, table cells, etc.).
document.documentElement.setAttribute("data-theme", "dark");
const themeStyle = document.createElement("style");
themeStyle.textContent = THEME_VARS;
document.head.appendChild(themeStyle);

createRoot(document.getElementById("root")!).render(<AdminApp />);
