import {
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
            const { state, status } = toVertexLoadableState(picked)
            // TODO Pass down errors
            if (status !== 'loaded') {
               latestOutputFields = loadingFields
               return loading$
            }

            const loaders$ = loadableFieldNames.map(fieldName => {
               const result$ = loaders[fieldName](state)
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
                     fields: {
                        ...latestInputFields,
                        ...outputFields
                     },
                     changedFields: { [fieldName]: true },
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
