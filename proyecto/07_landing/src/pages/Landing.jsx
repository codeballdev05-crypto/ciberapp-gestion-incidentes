import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUUpLeft, Fingerprint, LockKey, SealCheck } from '@phosphor-icons/react'
import Marca from '../components/Marca'
import EstadoApi from '../components/EstadoApi'
import TableroDemo from '../components/landing/TableroDemo'
import { useSesion } from '../lib/sesion'

// Etapas del ciclo y la regla que el sistema hace cumplir en cada una (RN-02…RN-10).
const ETAPAS = [
  ['registrado', 'Se da de alta con categoría, tipo, severidad, prioridad y un responsable desde el primer minuto.', 'RN-01'],
  ['asignado', 'El responsable confirma que lo atiende. La reasignación cierra la anterior y queda en el historial.', 'RF-030'],
  ['en investigación', 'Se registran acciones, comentarios y evidencias con su huella SHA-256.', 'RN-05'],
  ['resuelto', 'Se fija la fecha de resolución. El gestor verifica antes del cierre formal.', 'RF-050'],
  ['cerrado', 'Solo con al menos una acción documentada. Después nada se edita: se agrega una acción posterior o se reabre con justificación.', 'RN-06 · RN-10'],
]

// Reglas con la respuesta real que devuelve la API (prueba, no promesa).
const REGLAS = [
  {
    titulo: 'Ningún incidente queda sin dueño',
    texto: 'El registro exige un responsable activo con rol de atención. No hay bandeja de "sin asignar".',
    codigo: 'RESPONSABLE_INVALIDO',
    mensaje: 'El responsable debe ser un usuario activo con rol analista, gestor o administrador',
    estado: 422,
  },
  {
    titulo: 'Lo crítico se atiende primero',
    texto: 'Si la severidad es crítica, la prioridad tiene que ser alta. El formulario lo ajusta solo y la API lo vuelve a comprobar.',
    codigo: 'RN04_CRITICO_PRIORIDAD',
    mensaje: 'Un incidente de severidad crítica debe tener prioridad alta (RN-04)',
    estado: 422,
  },
  {
    titulo: 'No se cierra lo que no se trabajó',
    texto: 'El cierre exige al menos una acción registrada con autor, fecha y descripción.',
    codigo: 'RN06_SIN_ACCION',
    mensaje: 'No se puede cerrar: registre al menos una acción que justifique la resolución (RN-06)',
    estado: 422,
  },
  {
    titulo: 'Dos personas, un mismo incidente',
    texto: 'Si alguien lo modificó mientras usted lo editaba, su cambio no pisa el otro: se le pide recargar.',
    codigo: 'VERSION_DESACTUALIZADA',
    mensaje: 'El incidente fue modificado por otro usuario. Recargue y vuelva a intentar.',
    estado: 409,
  },
]

const ROLES = [
  ['Administrador', 'Todo lo del gestor, más usuarios, roles y la bitácora de auditoría.'],
  ['Gestor', 'Registra, clasifica, asigna, cierra y reabre incidentes. Ve los indicadores.'],
  ['Analista', 'Ve solo los incidentes que tiene asignados. Los investiga, documenta y resuelve.'],
  ['Consultor', 'Lee todos los incidentes y los indicadores. No modifica nada.'],
]

const CAPACIDADES = [
  ['Ver todos los incidentes', [1, 1, 0, 1]],
  ['Registrar y clasificar', [1, 1, 0, 0]],
  ['Asignar y reasignar', [1, 1, 0, 0]],
  ['Investigar: acciones, evidencias', [1, 1, 1, 0]],
  ['Cerrar y reabrir', [1, 1, 0, 0]],
  ['Indicadores', [1, 1, 0, 1]],
  ['Usuarios y auditoría', [1, 0, 0, 0]],
]

export default function Landing() {
  const { usuario } = useSesion()
  const destino = usuario ? '/panel' : '/entrar'
  const textoCta = usuario ? 'Ir al panel' : 'Entrar al panel'

  return (
    <>
      <a href="#contenido" className="saltar">Saltar al contenido</a>
      <header className="cabecera">
        <div className="contenedor cabecera__fila">
          <Marca />
          <nav aria-label="Secciones" className="cabecera__nav">
            <a href="#ciclo">Ciclo de vida</a>
            <a href="#reglas">Reglas</a>
            <a href="#rastro">Rastro</a>
            <a href="#roles">Roles</a>
          </nav>
          <Link to={destino} className="boton boton--tinta boton--chico">{textoCta}</Link>
        </div>
      </header>

      <main id="contenido">
        <section className="hero contenedor" aria-labelledby="hero-titulo">
          <h1 id="hero-titulo">Cada incidente, de la alerta al cierre, con un rastro que nadie borra.</h1>
          <div className="hero__texto">
            <p className="hero__bajada">
              Registre, asigne y cierre incidentes de ciberseguridad con reglas que el sistema hace cumplir:
              responsable desde el primer minuto, cierre solo con acciones documentadas e historial de solo escritura.
            </p>
            <div className="hero__acciones">
              <Link to={destino} className="boton boton--primario">
                {textoCta} <ArrowRight size={18} weight="bold" aria-hidden="true" />
              </Link>
              <a href="#ciclo" className="boton boton--secundario">Ver cómo funciona</a>
            </div>
            <EstadoApi />
          </div>
          <div className="hero__tablero">
            <TableroDemo />
          </div>
        </section>

        <section id="ciclo" className="seccion contenedor" aria-labelledby="ciclo-titulo">
          <div className="seccion__cabeza">
            <h2 id="ciclo-titulo">Cinco estados. Ninguno se salta.</h2>
            <p>
              Un incidente solo avanza al estado siguiente. Pasar de registrado a cerrado de un salto
              devuelve <code>409 TRANSICION_INVALIDA</code>.
            </p>
          </div>
          <ol className="ciclo">
            {ETAPAS.map(([nombre, texto, regla], i) => (
              <li key={nombre} className="ciclo__etapa">
                <span className="ciclo__orden dato" aria-hidden="true">{i + 1}/5</span>
                <h3>{nombre}</h3>
                <p>{texto}</p>
                <span className="ciclo__regla dato">{regla}</span>
              </li>
            ))}
          </ol>
          <p className="ciclo__reapertura">
            <ArrowUUpLeft size={20} weight="bold" aria-hidden="true" />
            <span>
              <strong>Reapertura:</strong> un incidente cerrado vuelve a <em>en investigación</em> solo con una
              justificación, que queda registrada como acción.
            </span>
          </p>
        </section>

        <section id="reglas" className="seccion seccion--papel" aria-labelledby="reglas-titulo">
          <div className="contenedor">
            <div className="seccion__cabeza">
              <h2 id="reglas-titulo">Reglas que el sistema no deja romper</h2>
              <p>Cada regla se valida en el servidor. Esto es lo que responde la API cuando alguien lo intenta.</p>
            </div>
            <div className="reglas">
              {REGLAS.map((r) => (
                <article key={r.codigo} className="regla">
                  <div className="regla__texto">
                    <h3>{r.titulo}</h3>
                    <p>{r.texto}</p>
                  </div>
                  <pre className="regla__respuesta" aria-label={`Respuesta de la API: ${r.mensaje}`}>
                    <code>
                      <span className="regla__http">HTTP {r.estado}</span>{'\n'}
                      {'{ "error": {\n    "codigo": '}<span className="regla__codigo">"{r.codigo}"</span>{',\n    "mensaje": "'}{r.mensaje}{'"\n} }'}
                    </code>
                  </pre>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="rastro" className="seccion contenedor rastro" aria-labelledby="rastro-titulo">
          <div className="rastro__texto">
            <h2 id="rastro-titulo">El historial no tiene goma de borrar</h2>
            <p>
              Cada cambio de estado, reasignación o edición se escribe en el historial y en la bitácora de auditoría
              en la misma transacción. Si una de las dos falla, no se guarda ninguna.
            </p>
            <ul className="rastro__lista">
              <li>
                <LockKey size={22} weight="duotone" aria-hidden="true" />
                <span>La base de datos niega <code>UPDATE</code> y <code>DELETE</code> sobre historial y auditoría al usuario de la aplicación. No es una promesa del código: es un permiso que no existe.</span>
              </li>
              <li>
                <Fingerprint size={22} weight="duotone" aria-hidden="true" />
                <span>Cada evidencia se guarda con su huella SHA-256. Al descargarla, el servidor la vuelve a calcular y avisa si el archivo fue alterado.</span>
              </li>
              <li>
                <SealCheck size={22} weight="duotone" aria-hidden="true" />
                <span>Los inicios de sesión, también los fallidos, quedan en la bitácora con fecha y origen.</span>
              </li>
            </ul>
          </div>
          <div className="rastro__muestra" aria-label="Ejemplo ilustrativo de un historial">
            <p className="rastro__cabeza"><span className="dato">INC-000224</span> · Saturación del portal público</p>
            <ol className="historial">
              <li><span className="dato">08:41</span><b>registrado</b><span>Responsable: Marcelo Antezana</span></li>
              <li><span className="dato">08:43</span><b>asignado</b><span>Toma el caso</span></li>
              <li><span className="dato">08:57</span><b>en investigación</b><span>Tráfico desde 3 sistemas autónomos</span></li>
              <li className="historial__nota"><span className="dato">09:20</span><b>datos</b><span>severidad: media → alta</span></li>
              <li><span className="dato">10:05</span><b>resuelto</b><span>Limitación de tasa en el WAF</span></li>
              <li className="historial__rechazo"><span className="dato">10:06</span><b>intento</b><span>Cierre rechazado: falta acción (RN-06)</span></li>
            </ol>
            <p className="rastro__hash">
              <span>evidencia</span> <code>waf-bloqueos.log</code>
              <code className="rastro__sha">sha256 4f1c…9a2e</code>
              <span className="rastro__ok"><SealCheck size={16} weight="fill" aria-hidden="true" /> íntegra</span>
            </p>
            <p className="rastro__nota">Ejemplo ilustrativo</p>
          </div>
        </section>

        <section id="roles" className="seccion seccion--papel" aria-labelledby="roles-titulo">
          <div className="contenedor roles">
            <div className="seccion__cabeza">
              <h2 id="roles-titulo">Cada rol ve lo que le corresponde</h2>
              <p>
                El servidor decide en cada petición. Un analista que pide un incidente ajeno recibe
                <code> 404</code>: ni siquiera sabe que existe.
              </p>
              <dl className="roles__lista">
                {ROLES.map(([r, d]) => (
                  <div key={r}><dt>{r}</dt><dd>{d}</dd></div>
                ))}
              </dl>
            </div>
            <div className="tabla-marco" tabIndex={0} role="region" aria-label="Permisos por rol (desplazable)">
              <table className="tabla matriz">
                <caption className="visualmente-oculto">Permisos por rol</caption>
                <thead>
                  <tr>
                    <th scope="col">Capacidad</th>
                    {ROLES.map(([r]) => <th key={r} scope="col">{r}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {CAPACIDADES.map(([c, v]) => (
                    <tr key={c}>
                      <th scope="row">{c}</th>
                      {v.map((si, i) => (
                        <td key={ROLES[i][0]} className={si ? 'matriz__si' : 'matriz__no'}>
                          {si ? 'Sí' : 'No'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="cierre contenedor" aria-labelledby="cierre-titulo">
          <h2 id="cierre-titulo">Abra el panel y lleve un incidente de principio a fin.</h2>
          <p>
            El entorno de demostración incluye cinco usuarios, uno por perfil: <code>admin</code>, <code>gestor</code>,
            <code>analista</code>, <code>analista2</code> y <code>consultor</code>. La contraseña la entrega quien administra el entorno.
          </p>
          <Link to={destino} className="boton boton--primario">
            {textoCta} <ArrowRight size={18} weight="bold" aria-hidden="true" />
          </Link>
        </section>
      </main>

      <footer className="pie">
        <div className="contenedor pie__fila">
          <Marca />
          <p>Proyecto académico · Arquitectura de Software, módulo 3 · API <a href="/api/docs">documentada</a></p>
        </div>
      </footer>
    </>
  )
}
