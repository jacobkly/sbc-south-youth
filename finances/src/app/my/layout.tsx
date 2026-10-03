import { AppShell } from "@/components/nav/app-shell";

export default function MyRequestsLayout({ children }: LayoutProps<"/my">) {
  return <AppShell area="requests">{children}</AppShell>;
}
