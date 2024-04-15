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
import { toVertexLoadableState } from '../state/toVertexLoadableState'
import { pickFields } from '../state/pickFields'

export const loadFromFields =
   (fields: string[], loaders: any): VertexRun =>
   data$ => {
      let latestOutputData: VertexRunData
      const loadingFields: VertexFields = {}
      const loadableFieldNames = Object.keys(loaders)
      loadableFieldNames.forEach(fieldName => {
         loadingFields[fieldName] = {
            status: 'loading',
            value: undefined,
            errors: []
         }
      })

      const inputDataMaybeChanged$ = data$.pipe(
         map(data => ({
            data,
            hasChanged: !fields.every(
               fieldName => data.changedFields[fieldName] === undefined
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
                  latestOutputData === undefined ||
                  latestOutputData.fields[fieldName].status !== 'loading'
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
               return loading$.pipe(tap(data => (latestOutputData = data)))
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
               map(
                  ({ fieldName, field }): VertexRunData => ({
                     ...latestOutputData,
                     fields: {
                        ...latestOutputData.fields,
                        [fieldName]: field
                     },
                     changedFields: { [fieldName]: true }
                  })
               )
            )

            const loadable$ = merge(loading$, loaded$).pipe(
               tap(data => (latestOutputData = data))
            )

            return loadable$
         })
      )

      const inputDataHasNotChanged$ = inputDataMaybeChanged$.pipe(
         filter(_ => !_.hasChanged),
         map(() => latestOutputData)
      )

      return merge(inputDataHasChanged$, inputDataHasNotChanged$)
   }
