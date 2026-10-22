const conexion = document.querySelector('#conexion');
const direccion = document.querySelector('#api-url');
const actualizar = document.querySelector('#actualizar');
const solicitar = document.querySelector('#solicitar');
const mensaje = document.querySelector('#mensaje');
const resultado = document.querySelector('#resultado');

function obtenerUrl() {
  const url = new URL(direccion.value.trim());
  if (!['http:', 'https:'].includes(url.protocol) || url.search || url.hash) {
    throw new Error('Escribe una dirección HTTP o HTTPS sin parámetros ni fragmentos.');
  }
  return url.href.replace(/\/+$/, '');
}

async function consultar(base, ruta) {
  const control = new AbortController();
  const espera = setTimeout(() => control.abort(), 15000);
  try {
    const respuesta = await fetch(base + ruta, { signal: control.signal });
    const datos = await respuesta.json();
    if (!respuesta.ok) {
      throw new Error(typeof datos.detail === 'string' ? datos.detail : `Error HTTP ${respuesta.status}`);
    }
    return datos;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('La API tardó demasiado en responder.');
    if (error instanceof TypeError) throw new Error('No se pudo conectar. Revisa la dirección y que el balanceador esté iniciado.');
    throw error;
  } finally {
    clearTimeout(espera);
  }
}

function elemento(etiqueta, texto, clase) {
  const nodo = document.createElement(etiqueta);
  nodo.textContent = texto;
  if (clase) nodo.className = clase;
  return nodo;
}

function bloquear(ocupado) {
  actualizar.disabled = ocupado;
  solicitar.disabled = ocupado;
  direccion.disabled = ocupado;
}

function avisar(texto, error = false) {
  mensaje.textContent = texto;
  mensaje.className = error ? 'error' : '';
}

function limpiarDatos() {
  document.querySelector('#servidores').replaceChildren(filaMensaje('Datos no disponibles. Actualiza para volver a consultar.', 3));
  document.querySelector('#cantidad').textContent = 'Sin consultar';
  document.querySelector('#total').textContent = '—';
  document.querySelector('#total-servidores').textContent = '—';
  document.querySelector('#estadisticas').replaceChildren(filaMensaje('Sin datos disponibles.', 2));
}

function filaMensaje(texto, columnas) {
  const fila = document.createElement('tr');
  const celda = elemento('td', texto);
  celda.colSpan = columnas;
  fila.append(celda);
  return fila;
}

async function cargarDatos(base) {
  const [red, estadisticas] = await Promise.all([
    consultar(base, '/servidores'),
    consultar(base, '/estadisticas').catch(error => {
      throw new Error(`No se pudieron consultar las estadísticas: ${error.message}`);
    })
  ]);
  const servidores = red.servidores.map(servidor => {
    const fila = document.createElement('tr');
    const activo = servidor.estado === 'activo';
    const estado = document.createElement('td');
    estado.append(elemento('span', activo ? '● Activo' : '● Inactivo', `estado ${activo ? 'activo' : 'inactivo'}`));
    fila.append(
      elemento('td', servidor.nombre),
      elemento('td', servidor.puerto),
      estado
    );
    return fila;
  });
  document.querySelector('#servidores').replaceChildren(
    ...(servidores.length ? servidores : [filaMensaje('No hay servidores configurados.', 3)])
  );
  document.querySelector('#cantidad').textContent = `${red.total_servidores} configurados`;
  document.querySelector('#total').textContent = estadisticas.total_solicitudes;
  document.querySelector('#total-servidores').textContent = red.total_servidores;
  const filas = Object.entries(estadisticas.solicitudes_por_servidor).map(([nombre, cantidad]) => {
    const fila = document.createElement('tr');
    fila.append(elemento('td', nombre), elemento('td', cantidad));
    return fila;
  });
  document.querySelector('#estadisticas').replaceChildren(
    ...(filas.length ? filas : [filaMensaje('Todavía no se han procesado solicitudes.', 2)])
  );
}

async function refrescar(evento) {
  evento?.preventDefault();
  bloquear(true);
  avisar('Consultando la red…');
  resultado.textContent = 'Aquí aparecerá la respuesta del servidor.';
  try {
    await cargarDatos(obtenerUrl());
    avisar('Datos actualizados.');
  } catch (error) {
    limpiarDatos();
    avisar(error.message, true);
  } finally {
    bloquear(false);
  }
}

conexion.addEventListener('submit', refrescar);
solicitar.addEventListener('click', async () => {
  bloquear(true);
  avisar('Enviando solicitud…');
  resultado.textContent = 'Esperando respuesta…';
  try {
    const base = obtenerUrl();
    const datos = await consultar(base, '/solicitar');
    resultado.replaceChildren(
      elemento('strong', datos.resultado),
      elemento('p', `Atendida por: ${datos.servidor}`),
      elemento('p', `Puerto: ${datos.puerto}`),
      elemento('p', `Solicitudes atendidas por este servidor: ${datos.solicitudes_atendidas}`)
    );
    try {
      await cargarDatos(base);
      avisar('Solicitud procesada y estadísticas actualizadas.');
    } catch (error) {
      limpiarDatos();
      avisar(`La solicitud fue procesada, pero no se pudieron actualizar los datos: ${error.message}`, true);
    }
  } catch (error) {
    resultado.textContent = error.message;
    avisar('No se pudo completar la solicitud.', true);
  } finally {
    bloquear(false);
  }
});

refrescar();
