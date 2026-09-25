/**
 * Agrega atajos a `res` para que todas las respuestas exitosas de la API
 * salgan iguales. Se monta una sola vez en app.js y quedan disponibles en
 * cualquier handler.
 *
 * La convencion es: en exito se devuelve el recurso pelado (o un array pelado
 * en los listados) y manda el status HTTP. Los errores, en cambio, salen del
 * errorHandler centralizado con la forma { success: false, message, details? }.
 * Son formas distintas a proposito: el front distingue por status, no por una
 * propiedad del body.
 *
 * @example
 *   export async function listar(_req, res) {
 *     res.ok(await sedeService.listar());
 *   }
 *
 *   export async function crear(req, res) {
 *     const sede = await sedeService.crear(req.body);
 *     res.created(sede, `/api/sedes/${sede.id}`);
 *   }
 *
 *   export async function eliminar(req, res) {
 *     await sedeService.eliminar(req.params.id);
 *     res.noContent();
 *   }
 */
export function responseHelpers(_req, res, next) {
  /**
   * 200 con el recurso. Para listados, pasarle el array directamente: si esta
   * vacio se devuelve `[]` con 200, nunca un 404.
   *
   * @param {unknown} data Lo que se serializa como body.
   */
  res.ok = (data) => res.status(200).json(data);

  /**
   * 201 con el recurso recien creado.
   *
   * @param {unknown} data El recurso creado.
   * @param {string} [location] URL del recurso. Si viene, va en el header
   *   `Location`, que es lo que espera un cliente REST despues de un POST.
   */
  res.created = (data, location) => {
    if (location) res.location(location);
    return res.status(201).json(data);
  };

  /**
   * 204 sin body. Tipico despues de un DELETE.
   *
   * Se usa `.end()` y no `.json()` a proposito: un 204 con body hace que
   * algunos clientes (fetch incluido) exploten al intentar parsearlo.
   */
  res.noContent = () => res.status(204).end();

  next();
}

export default responseHelpers;
