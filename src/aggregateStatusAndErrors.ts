import { VertexInternalState } from "./VertexInternalState"
import { VertexType } from "./VertexType"

export const aggregateStatusAndErrors = <Type extends VertexType>(
   internalState: VertexInternalState<Type>
) => {
   const loadableKeys = Object.keys(internalState.loadableFields) as Array<
      keyof Type['loadableFields']
   >
   const loadableFields = loadableKeys.map(key => internalState.loadableFields[key])
   const errors = loadableFields.map(_ => _.error).filter(Boolean) as Error[]
   let error = false
   let loading = false
   loadableFields.forEach(_ => {
      if (_.status === 'error') error = true
      else if (_.status === 'loading') loading = true
   })
   const status = error ? 'error' : loading ? 'loading' : 'loaded'
   return { status, errors }
}
