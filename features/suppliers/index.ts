/**
 * Feature: Suppliers (Proveedores)
 *
 * Gestión de proveedores externos para materias primas.
 * Proveedores NO son usuarios del sistema — entidad independiente.
 *
 * Exports:
 * - Hooks: useSuppliers, useAllSuppliers, useProductSuppliers, useSupplierActions
 * - Components: SupplierSelect, SupplierQuickAddForm, SuppliersTable, SupplierForm
 */

export {
  useSuppliers,
  useAllSuppliers,
  useProductSuppliers,
  useSupplierActions,
} from "./hooks";

export {
  SupplierSelect,
  SupplierQuickAddForm,
  SuppliersTable,
  SupplierForm,
} from "./components";
