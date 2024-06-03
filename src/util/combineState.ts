import { VertexLoadableFields } from '../state/VertexLoadableFields'
import { VertexState } from '../state/VertexState'
import { VertexType } from '../VertexType'

export const combineState = <Type extends VertexType>(
   reduxState: Type['reduxState'],
   readonlyFields: Type['readonlyFields'],
   loadableFields: VertexLoadableFields<Type['loadableFields']>
): VertexState<Type> => {
   const loadableKeys = Object.keys(loadableFields) as Array<
      keyof typeof loadableFields
   >
   const loadedFields = {} as Record<(typeof loadableKeys)[number], any>
   loadableKeys.forEach(key => {
      loadedFields[key] = loadableFields[key].value
   })
   return { ...reduxState, ...readonlyFields, ...loadedFields }
}
