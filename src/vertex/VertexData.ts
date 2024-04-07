import { VertexFields } from '../run/VertexFields'
import { VertexReduxState } from '../state/VertexReduxState'

export interface VertexData {
   reduxState: VertexReduxState
   fields: VertexFields
}
