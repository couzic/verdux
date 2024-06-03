import { VertexId } from '../vertex/VertexId'

export const toVertexName = (vertexId: VertexId) => {
   const s = vertexId.toString().replace('Symbol(Vertex ', '')
   return s.substring(0, s.length - 1)
}
