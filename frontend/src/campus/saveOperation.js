import { campusFetch } from './api'

// The caller retains this frozen operation until the server establishes its outcome.
export function materialSaveOperation(collection, id, payload) {
  const operationId = crypto.randomUUID()
  return {
    path: `${collection}${id ? `/${id}` : ''}`,
    recoveryPath: `${collection}/save-operations/${operationId}`,
    method: id ? collection === '/api/resumes' ? 'PUT' : 'PATCH' : 'POST',
    body: JSON.stringify({ ...payload, operationId }),
    unknown: false,
  }
}

export async function saveMaterialOperation(operation) {
  if (operation.unknown) {
    try { const data = (await campusFetch(operation.recoveryPath)).data; operation.unknown = false; return data }
    catch (error) {
      // Only an explicit owner-scoped absence permits replaying the SAME operation.
      if (error.code !== 'SAVE_NOT_FOUND') throw error
    }
  }
  try {
    const data = (await campusFetch(operation.path, { method: operation.method, body: operation.body })).data
    operation.unknown = false
    return data
  } catch (error) {
    if (error.status >= 400 && error.status < 500 && !['REQUEST_TIMEOUT', 'ABORTED', 'SAVE_PENDING', 'SAVE_UNKNOWN', 'OPERATION_PENDING', 'OPERATION_CONFLICT'].includes(error.code)) {
      operation.unknown = false
      throw error
    }
    operation.unknown = true
    try { const data = (await campusFetch(operation.recoveryPath)).data; operation.unknown = false; return data }
    catch { throw error }
  }
}
