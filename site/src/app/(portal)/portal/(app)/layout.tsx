import { AppShell } from "@/components/portal/nav/app-shell";

// Every page here reads the sign-in cookie, so the whole group renders on
// each request instead of from a static shell. Each section still gets its
// own loading.tsx, so moving between sections shows it at once.
export const instant = false;

// The signed-in portal: the role gate and navigation around every page.
export default function SignedInLayout({ children }: LayoutProps<"/portal">) {
  return <AppShell>{children}</AppShell>;
}
