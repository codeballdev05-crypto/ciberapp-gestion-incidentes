// RF-070 / RNF-022: bitácora append-only. Se llama con el MISMO cliente de la
// transacción del cambio, para que cambio y auditoría se confirmen o reviertan juntos.
async function auditar(db, { usuarioId = null, incidenteId = null, operacion, entidad, registroId = null, origen = null }) {
  await db.query(
    `INSERT INTO auditoria (usuario_id, incidente_id, operacion, entidad, registro_id, origen)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [usuarioId, incidenteId, operacion, entidad, registroId, origen ? String(origen).slice(0, 100) : null]
  );
}

module.exports = { auditar };
