import { SerializedError } from '@reduxjs/toolkit'
import { GraphRunData } from '../run/RunData'
import {
   VertexLoadedFieldState,
   VertexLoadingFieldState
} from '../state/VertexFieldState'
import { VertexId } from '../vertex/VertexId'

export type SerializedGraphRunData = Omit<
   GraphRunData,
   'sideEffects' | 'fieldsByVertexId'
> & {
   fieldsByVertexId: Record<
      VertexId,
      Record<string, SerializedVertexFieldState>
   >
}

export type SerializedVertexFieldState<Value = any> =
   | VertexLoadedFieldState<Value>
   | VertexLoadingFieldState
   | SerializedVertexErrorFieldState

export interface SerializedVertexErrorFieldState {
   status: 'error'
   errors: SerializedError[]
   value: undefined
}
