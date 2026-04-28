import { z } from "zod";

/**
 * Entity: User
 *
 * Usuario del sistema con roles definidos por Insforge Auth.
 * Roles: cliente, operario, admin
 */

export const UserRoleEnum = z.enum(["cliente", "operario", "admin"]);
export type UserRole = z.infer<typeof UserRoleEnum>;

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email("Email inválido"),
  full_name: z.string().min(1, "El nombre es requerido"),
  role: UserRoleEnum,
  phone: z.string().optional(),
  address: z.string().optional(),
  is_active: z.boolean().default(true),
  created_at: z.string().datetime().optional(),
});

export type User = z.infer<typeof UserSchema>;
