import { AppShell } from "@/components/nav/app-shell";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <AppShell area="team">{children}</AppShell>;
}
