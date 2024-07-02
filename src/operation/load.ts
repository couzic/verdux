import { isObservable, map, merge, tap, share, first, mergeMap } from 'rxjs'
import { VertexRunData } from '../run/RunData'
import { VertexFields } from '../run/VertexFields'
import { VertexRun } from '../run/VertexRun'

export const load =
   (loaders: any): VertexRun =>
   inputData$ => {
      const data$ = inputData$.pipe(share())
      let latestInputFields: VertexFields | undefined = undefined

      const loadingFields: VertexFields = {}
      const loadableFieldNames = Object.keys(loaders)
      loadableFieldNames.forEach(fieldName => {
         loadingFields[fieldName] = {
            status: 'loading',
            value: undefined,
            errors: []
         }
      })
      let latestOutputFields = loadingFields

      const passingThrough$ = data$.pipe(
         tap(data => (latestInputFields = data.fields)),
         map(data => {
            const changedFields = { ...data.changedFields }
            if (data.initialRun) {
               loadableFieldNames.forEach(fieldName => {
                  changedFields[fieldName] = true
               })
            }
            return {
               ...data,
               fields: { ...data.fields, ...latestOutputFields },
               changedFields
            }
         })
      )

      const loaders$ = loadableFieldNames.map(fieldName => {
         const result$ = loaders[fieldName]
         if (!isObservable(result$))
            throw new Error(
               `Loader for value "${fieldName}" must return an observable, received "${result$}" instead.`
            )
         return result$.pipe(
            map(value => ({
               fieldName,
               field: {
                  status: 'loaded' as const,
                  value,
                  errors: []
               }
            }))
         )
      })

      const loaded$ = merge(...loaders$).pipe(
         map(({ fieldName, field }): VertexRunData => {
            const outputFields = {
               ...latestOutputFields,
               [fieldName]: field
            } as VertexFields
            latestOutputFields = outputFields
            return {
               action: undefined,
               initialRun: false,
               fields: { ...latestInputFields, ...outputFields },
               changedFields: { [fieldName]: true as const },
               reactions: [],
               sideEffects: [],
               fieldsReactions: []
            }
         })
      )

      const delayedLoaded$ = data$.pipe(
         first(),
         mergeMap(() => loaded$)
      )

      return merge(passingThrough$, delayedLoaded$)
   }
