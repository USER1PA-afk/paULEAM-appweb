/**
 * Feature: Auth (Autenticación)
 *
 * Integración con Insforge Auth. Gestión de sesión, roles (cliente, operario, admin),
 * guards de ruta y componentes de login/registro.
 *
 * - El registro crea el usuario con rol 'cliente' por defecto (trigger SQL).
 * - No hay verificación de email pendiente (auto-login inmediato).
 * - El signOut redirige al index principal ("/").
 *
 * Exports:
 * - Components: LoginForm, RegisterForm
 * - Hooks: useAuth, useRole
 */

export { LoginForm, RegisterForm } from "./components";
export { useAuth, useRole } from "./hooks";
