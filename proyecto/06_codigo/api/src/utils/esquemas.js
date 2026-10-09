// Validación de entrada en la frontera (zod). Longitudes alineadas con los CHECK de V001.
const { z } = require('zod');

// RNF-051: mensajes de validación comprensibles y en español (hallazgo de la revisión
// del paso 4: un id faltante respondía "Invalid input: expected number, received NaN").
z.config(z.locales.es());

// Vacío → undefined (campo faltante: "Obligatorio"); cualquier otro valor se convierte a número.
const NUM = 'Debe ser un número entero positivo';
const id = z.preprocess(
  (v) => (v === undefined || v === null || v === '' ? undefined : Number(v)),
  z.number({ error: (iss) => (iss.input === undefined ? 'Obligatorio' : NUM) }).int(NUM).positive(NUM)
);
const texto = (max) => z.string({ error: (iss) => (iss.input === undefined ? 'Obligatorio' : 'Debe ser texto') }).trim().min(1, 'Obligatorio').max(max, `Máximo ${max} caracteres`);
// undefined = "no enviado" (se respeta en PATCH); '' se normaliza a null en el servicio.
const textoOpcional = (max) => z.string().trim().max(max).nullish();

const login = z.object({
  usuario: z.string().trim().min(1).max(50),
  contrasena: z.string().min(1).max(200),
});

const crearIncidente = z.object({
  titulo: texto(200),
  descripcion: texto(5000),
  categoria_id: id,
  tipo_id: id,
  severidad_id: id,
  prioridad_id: id,
  responsable_id: id, // RN-01: responsable obligatorio desde el registro
  sistema_afectado: textoOpcional(150),
});

const actualizarIncidente = z
  .object({
    version: z.string().min(1, 'version es obligatoria (control de concurrencia)'),
    titulo: texto(200).optional(),
    descripcion: texto(5000).optional(),
    categoria_id: id.optional(),
    tipo_id: id.optional(),
    severidad_id: id.optional(),
    prioridad_id: id.optional(),
    sistema_afectado: textoOpcional(150),
  })
  .refine((d) => Object.entries(d).some(([k, v]) => k !== 'version' && v !== undefined), 'Debe enviar al menos un campo a modificar');

const cambiarEstado = z.object({
  version: z.string().min(1),
  estado: z.enum(['registrado', 'asignado', 'en investigación', 'resuelto', 'cerrado']),
  observacion: textoOpcional(1000),
  justificacion: textoOpcional(2000), // RN-10: obligatoria en la reapertura
});

const asignar = z.object({
  version: z.string().min(1),
  responsable_id: id,
  observacion: textoOpcional(1000),
});

const accion = z.object({ descripcion: texto(2000), resultado: textoOpcional(2000) });
const comentario = z.object({ texto: texto(2000) });

const filtrosIncidentes = z.object({
  estado: id.optional(),
  severidad: id.optional(),
  prioridad: id.optional(),
  categoria: id.optional(),
  tipo: id.optional(),
  responsable: id.optional(),
  desde: z.coerce.date().optional(),
  hasta: z.coerce.date().optional(),
  q: z.string().trim().max(100).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  por_pagina: z.coerce.number().int().min(1).max(100).default(20),
});

const contrasena = z
  .string()
  .min(10, 'Mínimo 10 caracteres')
  .max(200)
  .regex(/[A-Za-z]/, 'Debe contener letras')
  .regex(/\d/, 'Debe contener números');

const roles = z.array(z.enum(['administrador', 'gestor', 'analista', 'consultor'])).min(1).max(4);

const crearUsuario = z.object({
  usuario: z.string().trim().min(3).max(50).regex(/^[a-z0-9._-]+$/, 'Solo minúsculas, números, punto, guion'),
  nombre_completo: texto(150),
  correo: z.email().max(150).optional().nullable(),
  contrasena,
  roles,
});

const actualizarUsuario = z.object({
  nombre_completo: texto(150).optional(),
  correo: z.email().max(150).optional().nullable(),
  activo: z.boolean().optional(),
  roles: roles.optional(),
  contrasena: contrasena.optional(),
});

const paginacion = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  por_pagina: z.coerce.number().int().min(1).max(100).default(50),
});

module.exports = {
  id, login, crearIncidente, actualizarIncidente, cambiarEstado, asignar, accion, comentario,
  filtrosIncidentes, crearUsuario, actualizarUsuario, paginacion,
};
