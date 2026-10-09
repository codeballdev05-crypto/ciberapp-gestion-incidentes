const fecha = new Intl.DateTimeFormat('es', { day: '2-digit', month: 'short', year: 'numeric' })
const fechaHora = new Intl.DateTimeFormat('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
const hora = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' })

export const fmtFecha = (v) => (v ? fecha.format(new Date(v)) : '—')
export const fmtFechaHora = (v) => (v ? fechaHora.format(new Date(v)) : '—')
export const fmtHora = (v) => (v ? hora.format(new Date(v)) : '—')

// "crítica" → "critica" para clases CSS.
export const claseSev = (nombre = '') => nombre.normalize('NFD').replace(/[̀-ͯ]/g, '')

export const ESTADOS = ['registrado', 'asignado', 'en investigación', 'resuelto', 'cerrado']

// Nombre corto para fichas: "Analista Dos Demo" → "Analista D."
export const nombreCorto = (n = '') => {
  const p = n.split(' ')
  return p.length > 1 ? `${p[0]} ${p[1][0]}.` : n
}
