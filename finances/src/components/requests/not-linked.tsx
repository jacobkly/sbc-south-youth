import { NarrowPage } from "@/components/nav/app-shell";

/**
 * For a requester whose account isn't linked to a payee yet. Requests are
 * always paid to the person who sends them, so there's nothing to do until an
 * owner links it.
 */
export function NotLinked({ title }: { title: string }) {
  return (
    <NarrowPage className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <div className="space-y-2 rounded-lg border border-dashed px-4 py-10 text-center">
        <p className="font-medium">Your account isn&apos;t linked to a payee yet</p>
        <p className="text-sm text-muted-foreground">
          Requests are paid back to you, so an owner has to link your account first. Ask one to do it.
        </p>
      </div>
    </NarrowPage>
  );
}
