import { VertexFieldsDefinition } from '../config/VertexFieldsDefinition'
import { VertexStatus } from '../vertex/VertexStatus'
import { VertexFieldState } from './VertexFieldState'
import { VertexLoadedState, VertexState } from './VertexState'

export type VertexLoadableState<
   Fields extends VertexFieldsDefinition,
   Status extends VertexStatus = VertexStatus
> = {
   status: Status
   errors: Status extends 'error' ? Error[] : []
   state: Status extends 'loaded'
      ? VertexLoadedState<Fields>
      : VertexState<Fields>
   fields: {
      [K in keyof Fields]: VertexFieldState<Fields[K]['value']>
   }
}
