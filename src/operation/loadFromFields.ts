import {
   catchError,
   filter,
   isObservable,
   map,
   merge,
   of,
   share,
   switchMap,
   tap
} from 'rxjs'
import { VertexRunData } from '../run/RunData'
import { VertexChangedFields, VertexFields } from '../run/VertexFields'
import { VertexRun } from '../run/VertexRun'
import { compareVertexFields } from '../run/compareVertexFields'
import { VertexFieldState } from '../state/VertexFieldState'
import { pickFields } from '../state/pickFields'
import { toVertexLoadableState } from '../state/toVertexLoadableState'

export const loadFromFields =
   (fields: string[], loaders: any): VertexRun =>
   data$ => {
      const loadingFields: VertexFields = {}
      const loadableFieldNames = Object.keys(loaders)
      loadableFieldNames.forEach(fieldName => {
         loadingFields[fieldName] = {
            status: 'loading',
            value: undefined,
            errors: []
         }
      })
      let latestInputFields: VertexFields | undefined = undefined
      let latestOutputFields = loadingFields
      const inputDataMaybeChanged$ = data$.pipe(
         tap(data => (latestInputFields = data.fields)),
         map(data => ({
            data,
            hasChanged: fields.some(
               fieldName => data.changedFields[fieldName] !== undefined
            )
         })),
         share()
      )

      const inputDataHasChanged$ = inputDataMaybeChanged$.pipe(
         filter(_ => _.hasChanged),
         switchMap(({ data }) => {
            const changedLoadingFields: VertexChangedFields = {}
            loadableFieldNames.forEach(fieldName => {
               if (
                  data.initialRun ||
                  latestOutputFields[fieldName].status !== 'loading'
               ) {
                  changedLoadingFields[fieldName] = true
               }
            })

            const loading$ = of({
               ...data,
               fields: { ...data.fields, ...loadingFields },
               changedFields: { ...data.changedFields, ...changedLoadingFields }
            })
            const picked = pickFields(fields, data.fields)
            const { state, status, errors } = toVertexLoadableState(picked)
            if (status === 'error') {
               const errorFields: VertexFields = {}
               const changedErrorFields: VertexChangedFields = {}
               loadableFieldNames.forEach(fieldName => {
                  errorFields[fieldName] = {
                     status: 'error',
                     value: undefined,
                     errors
                  }
                  if (
                     data.initialRun ||
                     latestOutputFields[fieldName].status !== 'error'
                  ) {
                     changedErrorFields[fieldName] = true
                  }
               })
               latestOutputFields = errorFields
               return of({
                  ...data,
                  fields: { ...data.fields, ...errorFields },
                  changedFields: { ...data.changedFields, ...changedErrorFields }
               })
            }
            latestOutputFields = loadingFields
            if (status === 'loading') {
               return loading$
            }

            const loaders$ = loadableFieldNames.map(fieldName => {
               // A loader's contract is to return an Observable. Failing to —
               // throwing synchronously, or returning a non-Observable — never
               // produced an Observable, which is a programming error, not a
               // runtime data failure: it is NOT contained, it escapes to the
               // graph-level handler and fails fast and loud. Only an error
               // delivered THROUGH the returned Observable (below) is a runtime
               // error and degrades the field.
               const result$ = loaders[fieldName](state)
               if (!isObservable(result$))
                  throw new Error(
                     `Loader for value "${fieldName}" must return an observable, received "${result$}" instead.`
                  )
               // An error from the returned stream becomes an error field for
               // this field only, leaving every other field and the vertex
               // stream alive. The errored source is terminal (we do NOT
               // re-subscribe), but this operation rebuilds its loaders on the
               // next input change, so a later successful run restores `loaded`.
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
                  // Flag the field changed only when it actually changed: a
                  // loader re-emitting a reference-identical value is a no-op,
                  // so we must not mark it changed or change-gated reads (pick)
                  // would re-fire and downstream subgraphs would re-run for
                  // nothing.
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
                     fields: {
                        ...latestInputFields,
                        ...outputFields
                     },
                     changedFields,
                     reactions: [],
                     fieldsReactions: [],
                     sideEffects: [],
                     initialRun: false
                  }
               })
            )

            const loadable$ = merge(loading$, loaded$)

            return loadable$
         })
      )

      const inputDataHasNotChanged$ = inputDataMaybeChanged$.pipe(
         filter(_ => !_.hasChanged),
         map(({ data }) => ({
            ...data,
            fields: { ...data.fields, ...latestOutputFields }
         }))
      )

      return merge(inputDataHasChanged$, inputDataHasNotChanged$)
   }
