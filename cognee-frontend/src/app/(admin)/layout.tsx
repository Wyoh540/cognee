import AdminShell from "./admin/AdminShell";

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AdminShell>{children}</AdminShell>;
}
