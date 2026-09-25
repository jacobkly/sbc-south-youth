"use client";

import { useState } from "react";
import { PencilIcon } from "lucide-react";
import { PayeeSheet } from "@/components/payees/payee-form";
import { Button } from "@/components/ui/button";
import type { PayeeRow } from "@/lib/payees/columns";

/** Opens the edit sheet for a payee, where the admin can also deactivate them. */
export function EditPayeeButton({ payee }: { payee: PayeeRow }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" className="h-11 px-4" onClick={() => setOpen(true)}>
        <PencilIcon aria-hidden />
        Edit
      </Button>
      <PayeeSheet payee={open ? payee : null} onClose={() => setOpen(false)} />
    </>
  );
}
