import { PickedInternalState } from "./PickedInternalState"
import { VertexInternalState } from "./VertexInternalState"
import { VertexStateKey } from "./VertexState"
import { VertexType } from "./VertexType"

export const pickInternalState = <
  Type extends VertexType,
  K extends VertexStateKey<Type>
>(
  internalState: VertexInternalState<Type>,
  keys: K[]
): PickedInternalState<Type, K> => {
  const { status, errors } = internalState
  const reduxState: any = {}
  const readonlyFields: any = {}
  const loadableFields: any = {}
  keys.forEach(key => {
    if (key in internalState.loadableFields) {
      loadableFields[key] = internalState.loadableFields[key]
    } else if (key in internalState.readonlyFields) {
      readonlyFields[key] = internalState.readonlyFields[key]
    } else if (key in internalState.reduxState.vertex) {
      reduxState[key] = internalState.reduxState.vertex[key]
    }
  })
  return {
    status,
    errors,
    reduxState,
    readonlyFields,
    loadableFields
  } as any
}
