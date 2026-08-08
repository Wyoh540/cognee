"use client";

import { Text } from "@mantine/core";
import WorkspacesPanel from "./WorkspacesPanel";

export default function AdminPage() {
  return (
    <div className="flex min-h-full flex-col p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="m-0 text-xl font-medium text-[#EDECEA]">Workspaces</h1>
        <Text size="sm" style={{ color: "rgba(237,236,234,0.55)", marginTop: 4 }}>
          Manage every workspace across the platform.
        </Text>
      </div>
      <WorkspacesPanel />
    </div>
  );
}
