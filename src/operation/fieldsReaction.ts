import { map } from 'rxjs'
import { VertexRun } from '../run/VertexRun'
import { LazyVertexLoadableStateWithDependencies } from '../state/LazyVertexLoadableStateWithDependencies'
import { combineFields } from '../state/combineFields'
import { pickFields } from '../state/pickFields'

export const fieldsReaction =
   (fields: string[], mapper: any) =>
   (dependencies: any): VertexRun =>
      map(data => {
         if (fields.some(field => data.changedFields[field])) {
            const pickedFields = pickFields(fields, data.fields)
            const pickedState = combineFields(pickedFields).state
            const loadableState = new LazyVertexLoadableStateWithDependencies(
               data.fields,
               dependencies
            )
            const reaction = mapper(pickedState, loadableState)
            return {
               ...data,
               fieldsReactions: [...data.fieldsReactions, reaction]
            }
         } else {
            return data
         }
      })
