import { VertexStatus } from '../vertex/VertexStatus'

export interface VertexFieldState<Value = any, Status = VertexStatus> {
   status: Status
   errors: Status extends 'error' ? Error[] : []
   value: Status extends 'loaded' ? Value : undefined
}
