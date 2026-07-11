"use client";

import { useRouter } from "next/navigation";
import { RecipeList } from "@features/recipes";
import { useRole } from "@features/auth/hooks";
import { Plus } from "lucide-react";

export default function AdminRecipesPage() {
  const router = useRouter();
  const { role } = useRole();
  const isAdmin = role === "admin";
  const isStaff = role === "admin" || role === "operario";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Recetas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAdmin
              ? "Fórmulas de producción con ingredientes, rendimiento base e instrucciones."
              : "Fórmulas de producción. Las eliminaciones requieren aprobación de un administrador."}
          </p>
        </div>
        {isStaff && (
          <button
            onClick={() => router.push("/admin/recipes/new")}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nueva Receta
          </button>
        )}
      </div>

      <RecipeList canEdit={isStaff} canRequestDelete={isStaff} />
    </div>
  );
}
