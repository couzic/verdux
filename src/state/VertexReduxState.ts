export interface VertexReduxState {
   vertex: Record<string, unknown>
   downstream: Record<string, VertexReduxState>
}
