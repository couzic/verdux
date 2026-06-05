import {
   catchError,
   isObservable,
   map,
   merge,
   of,
   tap,
   share,
   first,
   mergeMap
} from 'rxjs'
import { VertexRunData } from '../run/RunData'
import { VertexFields } from '../run/VertexFields'
import { VertexRun } from '../run/VertexRun'
import { compareVertexFields } from '../run/compareVertexFields'
import { VertexFieldState } from '../state/VertexFieldState'

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
         // A loader error is captured as an error field for THAT field only,
         // leaving the merged stream (and every other field) alive. The errored
         // source is terminal — `load` builds its loaders once, so the field
         // stays in error (we deliberately do NOT re-subscribe, which would loop
         // on a synchronously-erroring source).
         return result$.pipe(
            map(value => {
               const field: VertexFieldState = {
                  status: 'loaded',
                  value,
                  errors: []
               }
               return { fieldName, field }
            }),
            catchError(error => {
               const field: VertexFieldState = {
                  status: 'error',
                  value: undefined,
                  errors: [error]
               }
               return of({ fieldName, field })
            })
         )
      })

      const loaded$ = merge(...loaders$).pipe(
         map(({ fieldName, field }): VertexRunData => {
            // Flag the field changed only when it actually changed: a loader
            // re-emitting a reference-identical value is a no-op, so we must not
            // mark it changed or change-gated reads (pick) would re-fire and
            // downstream subgraphs would re-run for nothing.
            const changedFields = compareVertexFields(latestOutputFields, {
               [fieldName]: field
            })
            const outputFields = {
               ...latestOutputFields,
               [fieldName]: field
            }
            latestOutputFields = outputFields
            return {
               action: undefined,
               initialRun: false,
               fields: { ...latestInputFields, ...outputFields },
               changedFields,
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
