/**
 * Shared Types
 *
 * Tipos globales reutilizables que no pertenecen a un entity o feature específico.
 */

/** Respuesta genérica de la API */
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  count?: number;
}

/** Parámetros de paginación */
export interface PaginationParams {
  page: number;
  pageSize: number;
}

/** Resultado paginado */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
