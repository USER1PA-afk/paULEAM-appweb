"use client";

import { useParams } from "next/navigation";
import { RecipeForm } from "@features/recipes";

export default function EditRecipePage() {
  const params = useParams();
  const recipeId = params.id as string;

  return <RecipeForm recipeId={recipeId} />;
}
