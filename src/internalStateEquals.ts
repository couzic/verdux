import { VertexInternalState } from './VertexInternalState'
import { VertexType } from './VertexType'
import { shallowEquals } from './shallowEquals'

export function internalStateEquals<Type extends VertexType>(
  previous: VertexInternalState<Type>,
  next: VertexInternalState<Type>
): boolean {
  return (
    shallowEquals(previous.reduxState, next.reduxState) &&
    shallowEquals(previous.readonlyFields, next.readonlyFields) &&
    shallowEquals(previous.loadableFields, next.loadableFields) // TODO Dig deeper in each loadable value
  )
}