import { VertexFieldsDefinition } from '../config/VertexFieldsDefinition'
import { VertexFieldState } from './VertexFieldState'
import { VertexErrorState, VertexLoadedState, VertexState } from './VertexState'
import { VertexStatus } from '../vertex/VertexStatus'

export type VertexLoadableState<
   Fields extends VertexFieldsDefinition,
   Status extends VertexStatus = VertexStatus
> = {
   status: Status
   errors: Status extends 'error' ? Error[] : []
   state: Status extends 'loaded'
      ? VertexLoadedState<Fields>
      : Status extends 'loading'
        ? VertexState<Fields>
        : Status extends 'error'
          ? VertexErrorState<Fields>
          : never
   fields: {
      [K in keyof Fields]: VertexFieldState<Fields[K]['value']>
   }
}
