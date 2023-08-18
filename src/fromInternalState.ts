import { VertexInternalState } from "./VertexInternalState"
import { VertexState } from "./VertexState"
import { VertexType } from "./VertexType"

export const fromInternalState = <Type extends VertexType>(internalState: VertexInternalState<Type>): VertexState<Type> => {
  const { reduxState, readonlyFields, loadableFields } = internalState
  const loadableKeys = Object.keys(loadableFields) as Array<
    keyof typeof loadableFields
  >
  const loadedFields = {} as Record<(typeof loadableKeys)[number], any>
  loadableKeys.forEach(key => {
    loadedFields[key] = loadableFields[key].value
  })
  return { ...reduxState.vertex, ...readonlyFields, ...loadedFields }
}
