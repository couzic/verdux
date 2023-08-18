import { VertexInternalState } from "./VertexInternalState"
import { VertexState } from "./VertexState"
import { VertexType } from "./VertexType"

export const fromInternalState = <Type extends VertexType>(internalState: VertexInternalState<Type>): VertexState<Type> => {
  const state = { ...internalState.reduxState.vertex, ...internalState.readonlyFields }
  return state
}
