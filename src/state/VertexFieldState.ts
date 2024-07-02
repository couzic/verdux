export type VertexFieldState<Value = any> =
   | VertexLoadedFieldState<Value>
   | VertexLoadingFieldState
   | VertexErrorFieldState

export interface VertexLoadedFieldState<Value> {
   status: 'loaded'
   errors: []
   value: Value
}

export interface VertexLoadingFieldState {
   status: 'loading'
   errors: []
   value: undefined
}

export interface VertexErrorFieldState {
   status: 'error'
   errors: Error[]
   value: undefined
}
