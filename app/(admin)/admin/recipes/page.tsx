"use client";

import { useRouter } from "next/navigation";
import { RecipeList } from "@features/recipes";
import { Plus } from "lucide-react";

export default function AdminRecipesPage() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Recetas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Fórmulas de producción con ingredientes, rendimiento base e instrucciones.
          </p>
        </div>
        <button
          onClick={() => router.push("/admin/recipes/new")}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nueva Receta
        </button>
      </div>

      <RecipeList />
    </div>
  );
}
