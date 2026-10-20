// Prepara la foto del voucher: la reduce y la convierte a JPEG para que suba rápido
// (las fotos de celular pesan varios MB). Devuelve un Blob.
const LADO_MAXIMO = 1600
const CALIDAD = 0.82

function cargarImagen(archivo) {
  return new Promise((resolver, rechazar) => {
    const url = URL.createObjectURL(archivo)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolver(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      rechazar(new Error('No se pudo leer la imagen'))
    }
    img.src = url
  })
}

export async function comprimirImagen(archivo) {
  const img = await cargarImagen(archivo)
  const escala = Math.min(1, LADO_MAXIMO / Math.max(img.width, img.height))
  const lienzo = document.createElement('canvas')
  lienzo.width = Math.round(img.width * escala)
  lienzo.height = Math.round(img.height * escala)
  const ctx = lienzo.getContext('2d')
  ctx.fillStyle = '#ffffff' // fondo blanco por si la imagen tiene transparencia
  ctx.fillRect(0, 0, lienzo.width, lienzo.height)
  ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height)
  return new Promise((resolver, rechazar) => lienzo.toBlob((b) => (b ? resolver(b) : rechazar(new Error('No se pudo preparar la imagen'))), 'image/jpeg', CALIDAD))
}

export function blobADataUrl(blob) {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader()
    lector.onload = () => resolver(lector.result)
    lector.onerror = () => rechazar(new Error('No se pudo leer la imagen'))
    lector.readAsDataURL(blob)
  })
}
