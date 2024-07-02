import { VertexFieldsDefinition } from '../config/VertexFieldsDefinition'
import {
   VertexErrorFieldState,
   VertexLoadedFieldState,
   VertexLoadingFieldState
} from './VertexFieldState'
import { VertexLoadedState, VertexState } from './VertexState'

export type VertexLoadableState<Fields extends VertexFieldsDefinition> =
   | {
        status: 'loaded'
        errors: []
        state: VertexLoadedState<Fields>
        fields: {
           [K in keyof Fields]: VertexLoadedFieldState<Fields[K]['value']>
        }
     }
   | {
        status: 'loading'
        errors: []
        state: VertexState<Fields>
        fields: {
           [K in keyof Fields]:
              | VertexLoadedFieldState<Fields[K]['value']>
              | VertexLoadingFieldState
        }
     }
   | {
        status: 'error'
        errors: Error[]
        state: VertexState<Fields>
        fields: {
           [K in keyof Fields]:
              | VertexLoadedFieldState<Fields[K]['value']>
              | VertexLoadingFieldState
              | VertexErrorFieldState
        }
     }
