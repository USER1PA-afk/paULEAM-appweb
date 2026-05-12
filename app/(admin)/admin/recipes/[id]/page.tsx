"use client";

import { useParams } from "next/navigation";
import { RecipeDetail } from "@features/recipes";

export default function RecipeDetailPage() {
  const params = useParams();
  const recipeId = params.id as string;

  return <RecipeDetail recipeId={recipeId} />;
}
