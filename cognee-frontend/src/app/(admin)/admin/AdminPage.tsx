import WorkspacesPanel from "./WorkspacesPanel";
import { AdminPage as Page, AdminPageHeader } from "./AdminUI";

export default function AdminPage() {
  return (
    <Page>
      <AdminPageHeader title="Workspaces" description="Manage every workspace across the platform." />
      <WorkspacesPanel />
    </Page>
  );
}
