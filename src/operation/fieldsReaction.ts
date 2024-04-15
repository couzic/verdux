import { map } from 'rxjs'
import { VertexRun } from '../run/VertexRun'
import { LazyVertexLoadableStateWithDependencies } from '../state/LazyVertexLoadableStateWithDependencies'
import { pickFields } from '../state/pickFields'
import { toVertexState } from '../state/toVertexState'

export const fieldsReaction =
   (fields: string[], mapper: any) =>
   (dependencies: any): VertexRun =>
      map(data => {
         if (fields.some(field => data.changedFields[field])) {
            const pickedFields = pickFields(fields, data.fields)
            const pickedState = toVertexState(pickedFields)
            const loadableState = new LazyVertexLoadableStateWithDependencies(
               data.fields,
               dependencies
            )
            const reaction = mapper(pickedState, loadableState)
            if (reaction === null) {
               return data
            }
            // TODO check if mapper output is a valid reaction
            return {
               ...data,
               fieldsReactions: [...data.fieldsReactions, reaction]
            }
         } else {
            return data
         }
      })
