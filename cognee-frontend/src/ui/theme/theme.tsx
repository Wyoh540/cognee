import { createTheme } from "@mantine/core";
import colors from "./colors";
import typography from "./typography";

const theme = createTheme({
  ...colors,
  ...typography,
  primaryColor: "primary2",
  primaryShade: { light: 6, dark: 3 },
  defaultRadius: "0.5rem",
  defaultGradient: { from: "primary2.6", to: "primary2.4", deg: 135 },
  cursorType: "pointer",
  components: {
    Button: { defaultProps: { radius: "md" } },
    Input: { defaultProps: { radius: "md" } },
    Modal: { defaultProps: { centered: true, overlayProps: { blur: 4 } } },
    Paper: {
      defaultProps: { radius: "md" },
      styles: { root: { borderColor: "var(--mantine-color-dark-5)" } },
    },
  },
});

export default theme;
