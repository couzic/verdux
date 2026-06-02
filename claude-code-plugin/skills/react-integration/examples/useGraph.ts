import { useContext } from 'react'
import { Graph } from 'verdux'
import { GraphContext } from './GraphContext'

// Returns the graph from Context. Use this ONLY when a component must resolve
// the graph through Context — e.g. a test that wraps the tree in a provider
// carrying a different (test) graph, so reads (useVertexState) and dispatches
// hit the same instance. In production code, just `import { graph }` and call
// `graph.dispatch(...)` inline.
//
// It returns the graph itself (a stable reference), NOT a per-render dispatch
// wrapper — so it is safe in effect/memo deps and never collides with
// react-redux's useDispatch. Call `graph.dispatch(...)` / `graph.getVertexInstance(...)`
// on the result.
export const useGraph = (): Graph => {
   const graph = useContext(GraphContext)
   if (!graph) throw new Error('No verdux graph found in Context')
   return graph
}
