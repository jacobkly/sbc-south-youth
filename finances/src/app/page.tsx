import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { homePathFor } from "@/lib/auth/roles";

/** Sends each person to where they start: the dashboard, or their own requests. */
export default async function Home() {
  const user = await getCurrentUser();
  redirect(user ? homePathFor(user) : "/admin");
}
