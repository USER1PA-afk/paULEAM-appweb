import { z } from "zod";

/**
 * Entity: DeletionRequest
 *
 * Approval queue for soft-deletion of products, suppliers, and recipes.
 * An operario submits a request → admin approves/rejects.
 * On APPROVE the RPC soft-archives the entity (is_active = false).
 */

export const DeletionEntityTypeEnum = z.enum(["product", "supplier", "recipe"]);
export type DeletionEntityType = z.infer<typeof DeletionEntityTypeEnum>;

export const DeletionStatusEnum = z.enum(["PENDING", "APPROVED", "REJECTED"]);
export type DeletionStatus = z.infer<typeof DeletionStatusEnum>;

export const ENTITY_TYPE_LABELS: Record<DeletionEntityType, string> = {
  product:  "Producto",
  supplier: "Proveedor",
  recipe:   "Receta",
};

export const DeletionRequestSchema = z.object({
  id:           z.string().uuid(),
  entity_type:  DeletionEntityTypeEnum,
  entity_id:    z.string().uuid(),
  entity_label: z.string(),
  requested_by: z.string().uuid(),
  requested_at: z.string(),
  reason:       z.string().nullable().optional(),
  status:       DeletionStatusEnum,
  reviewed_by:  z.string().uuid().nullable().optional(),
  reviewed_at:  z.string().nullable().optional(),
  review_note:  z.string().nullable().optional(),
});

export type DeletionRequest = z.infer<typeof DeletionRequestSchema>;

/** Row joined with requester's full_name + email from profiles */
export type DeletionRequestWithRequester = DeletionRequest & {
  requester_name: string | null;
  requester_email: string | null;
};
