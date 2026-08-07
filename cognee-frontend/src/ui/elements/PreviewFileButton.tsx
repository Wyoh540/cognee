"use client";

import { ActionIcon } from "@mantine/core";

export default function PreviewFileButton({ onClick }: { onClick: () => void }) {
  return (
    <ActionIcon
      aria-label="Preview file"
      title="Preview file"
      variant="transparent"
      color="gray"
      size={24}
      onClick={onClick}
      styles={{
        root: {
          opacity: 0.5,
          transition: "opacity 150ms",
          "&:hover": { opacity: 1 },
        },
      }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="3" stroke="#A1A1AA" strokeWidth="1.3" />
        <path d="M2 8s2.5-4.5 6-4.5S14 8 14 8s-2.5 4.5-6 4.5S2 8 2 8z" stroke="#A1A1AA" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </ActionIcon>
  );
}
