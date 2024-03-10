import { VertexStatus } from '../vertex/VertexStatus'

export interface VertexFieldState {
   status: VertexStatus
   errors: Error[]
   value: any
}
