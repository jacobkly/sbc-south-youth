import type { EditableRequest } from "@/components/requests/edit-request-form";
import { centsToDecimal } from "@/lib/money";
import type { SignedReceiptUrls } from "@/lib/receipts/signed-urls";
import type { RequestStatus } from "@/lib/requests/format";
import type { RequestType } from "@/lib/requests/schema";

/** What the edit pages read to open a request in the form. */
export const EDIT_REQUEST_COLUMNS = `
  request_number, status, created_by, payee_id, type, amount_cents, purchase_date, description,
  event_name, no_receipt, no_receipt_reason,
  lines:request_lines(id, amount_cents, vendor),
  receipts(id, line_id, storage_path, original_filename, mime_type, width, height)
` as const;

type EditRow = {
  request_number: number;
  status: RequestStatus;
  payee_id: string;
  type: RequestType;
  amount_cents: number;
  purchase_date: string;
  description: string | null;
  event_name: string | null;
  no_receipt: boolean;
  no_receipt_reason: string | null;
  lines: { id: string; amount_cents: number; vendor: string | null }[];
  receipts: {
    id: string;
    line_id: string;
    storage_path: string;
    original_filename: string;
    mime_type: string;
    width: number | null;
    height: number | null;
  }[];
};

/** Turns a row read with `EDIT_REQUEST_COLUMNS` into what the edit form starts from. */
export function toEditableRequest(
  id: string,
  row: EditRow,
  payeeName: string,
  signed: SignedReceiptUrls | null,
): EditableRequest {
  return {
    id,
    requestNumber: row.request_number,
    status: row.status,
    values: {
      payee_id: row.payee_id,
      type: row.type,
      purchase_date: row.purchase_date,
      lines: row.lines.map((line) => ({
        id: line.id,
        amount: centsToDecimal(line.amount_cents),
        vendor: line.vendor ?? "",
      })),
      description: row.description ?? "",
      event_name: row.event_name ?? "",
      no_receipt: row.no_receipt,
      no_receipt_reason: row.no_receipt_reason ?? "",
    },
    amountCents: row.amount_cents,
    payeeName,
    receipts: row.receipts.map((receipt) => ({
      id: receipt.id,
      lineId: receipt.line_id,
      path: receipt.storage_path,
      name: receipt.original_filename,
      mimeType: receipt.mime_type,
      width: receipt.width,
      height: receipt.height,
    })),
    signed,
  };
}
