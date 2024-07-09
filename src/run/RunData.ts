import { SerializedError, UnknownAction } from '@reduxjs/toolkit'
import {
   VertexLoadedFieldState,
   VertexLoadingFieldState
} from '../state/VertexFieldState'
import { VertexReduxState } from '../state/VertexReduxState'
import { VertexId } from '../vertex/VertexId'
import { VertexChangedFields, VertexFields } from './VertexFields'

export interface RunData {
   action: UnknownAction | undefined
   fieldsReactions: UnknownAction[]
   reactions: UnknownAction[]
   sideEffects: Array<() => void>
   initialRun: boolean
}

export interface GraphRunData extends RunData {
   reduxStateByVertexId: Record<VertexId, VertexReduxState>
   fieldsByVertexId: Record<VertexId, VertexFields>
   changedFieldsByVertexId: Record<VertexId, VertexChangedFields>
}

export interface VertexRunData extends RunData {
   fields: VertexFields
   changedFields: VertexChangedFields
}

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
