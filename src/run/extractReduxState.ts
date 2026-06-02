import { VertexConfigImpl } from '../config/VertexConfigImpl'
import { VertexReduxState } from '../state/VertexReduxState'

/**
 * Walk the root redux state tree down a vertex's precomputed redux path
 * (`coreInfo.reduxPathByVertexId[id]`, root → … → vertex) to extract that
 * vertex's own redux substate. `reduxPath[0]` is the root, so we start from the
 * root tree and follow `.downstream[name]` for each remaining step.
 *
 * This is what makes every vertex autonomous: given the root tree and its own
 * path, it derives its substate by itself — no parent hand-down needed.
 */
export const extractReduxState = (
   rootReduxState: VertexReduxState,
   reduxPath: VertexConfigImpl[]
): VertexReduxState => {
   let reduxState = rootReduxState
   for (let i = 1; i < reduxPath.length; i++) {
      reduxState = reduxState.downstream[reduxPath[i].name]
   }
   return reduxState
}
