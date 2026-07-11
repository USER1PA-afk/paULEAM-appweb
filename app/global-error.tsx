"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f5f5f5" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "2rem", textAlign: "center" }}>
          <p style={{ fontSize: "4rem", marginBottom: "1rem" }}>⚠️</p>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#121212", marginBottom: "0.5rem" }}>
            Algo salió mal
          </h1>
          <p style={{ color: "#4a4a49", fontSize: "0.875rem", marginBottom: "1.5rem" }}>
            {error.digest ? `Error ID: ${error.digest}` : "Se produjo un error inesperado."}
          </p>
          <button
            onClick={reset}
            style={{ background: "#cc0000", color: "#fff", border: "none", borderRadius: "0.5rem", padding: "0.625rem 1.5rem", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer" }}
          >
            Intentar de nuevo
          </button>
        </div>
      </body>
    </html>
  );
}
