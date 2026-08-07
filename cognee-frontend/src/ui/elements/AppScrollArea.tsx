"use client";

import { ScrollArea, type ScrollAreaProps } from "@mantine/core";
import classes from "./AppScrollArea.module.css";

interface AppScrollAreaProps extends ScrollAreaProps {
  fill?: boolean;
  fullHeight?: boolean;
}

/** Shared scroll container that keeps scrollbar behavior and styling consistent. */
export default function AppScrollArea({
  fill = false,
  fullHeight = false,
  scrollbarSize = 8,
  type = "hover",
  offsetScrollbars = "present",
  ...props
}: AppScrollAreaProps) {
  return (
    <ScrollArea
      scrollbarSize={scrollbarSize}
      type={type}
      offsetScrollbars={offsetScrollbars}
      classNames={{
        viewport: [
          fill ? classes.fillViewport : "",
          fullHeight ? classes.fullHeightViewport : "",
        ].filter(Boolean).join(" ") || undefined,
        scrollbar: classes.scrollbar,
        thumb: classes.thumb,
        corner: classes.corner,
      }}
      {...props}
    />
  );
}
