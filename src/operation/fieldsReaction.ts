import { map } from 'rxjs'
import { VertexRun } from '../run/VertexRun'
import { LazyVertexLoadableState } from '../state/LazyVertexLoadableState'
import { pickFields } from '../state/pickFields'
import { toVertexState } from '../state/toVertexState'

export const fieldsReaction = (fields: string[], mapper: any): VertexRun =>
   map(data => {
      if (data.initialRun || !fields.some(field => data.changedFields[field])) {
         return data
      }
      const pickedFields = pickFields(fields, data.fields)
      const pickedState = toVertexState(pickedFields)
      const loadableState = new LazyVertexLoadableState(data.fields)
      const reaction = mapper(pickedState, loadableState)
      if (reaction === null) {
         return data
      }
      // TODO check if mapper output is a valid reaction
      return {
         ...data,
         fieldsReactions: [...data.fieldsReactions, reaction]
      }
   })
