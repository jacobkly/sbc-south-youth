import { AppShell } from "@/components/nav/app-shell";

export default function AccountLayout({ children }: LayoutProps<"/account">) {
  return <AppShell>{children}</AppShell>;
}
