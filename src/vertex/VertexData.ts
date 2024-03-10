import { VertexReduxState } from '../state/VertexReduxState'
import { VertexFieldState } from '../state/VertexFieldState'

export interface VertexData {
   reduxState: VertexReduxState
   fields: Record<string, VertexFieldState>
}
