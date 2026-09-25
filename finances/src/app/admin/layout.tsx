import { AppShell } from "@/components/nav/app-shell";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <AppShell>{children}</AppShell>;
}
