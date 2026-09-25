import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CompressionLab } from "@/components/receipts/compression-lab";

export const metadata: Metadata = {
  title: "Compression test",
};

export default function CompressionTestPage() {
  // Dev-only tool for choosing receipt compression settings.
  if (process.env.NODE_ENV === "production") notFound();

  return <CompressionLab />;
}
