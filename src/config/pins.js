// PIN de acceso por perfil. Se guardan como hash SHA-256 (nunca en texto plano).
// Cada hash es SHA-256("pagos-castillo:" + PIN). PIN de prueba: ver README.
export const PIN_HASHES = {
  asistente: 'd1724ef9a5e273562be8ffd761bc38671b484dff8cde15e0beb0c5bd34c5f180',
  gerente: 'd1fa35cb677d32eb68f9cdcb002fce9ca8d7be902b481ae4f099ee6ce84a50bc',
}
export const PIN_PREFIJO = 'pagos-castillo:'
