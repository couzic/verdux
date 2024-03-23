import { isObservable, map, merge, of, scan, switchMap } from 'rxjs'
import { toVertexName } from '../config/toVertexName'
import { VertexTransformation } from '../graph/Transformable'
import { combineFields } from '../state/combineFields'
import { pickFields } from '../state/pickFields'
import { VertexId } from '../vertex/VertexId'
import { enrichVertexFields } from './enrichVertexFields'

export const loadFromFields = (
   vertexId: VertexId,
   fields: string[],
   loaders: any
): VertexTransformation =>
   switchMap(transformable => {
      const inputFields = transformable.vertexFields
      const { state, status, errors } = combineFields(
         pickFields(fields, inputFields)
      )
      const loadingFields = {
         ...inputFields
      }
      Object.keys(loaders).forEach(loadableField => {
         loadingFields[loadableField] = {
            status: 'loading',
            value: undefined,
            errors: []
         }
      })
      const loading$ = of(loadingFields)

      if (status === 'loading') {
         return of(enrichVertexFields(transformable, loadingFields))
      }

      const loaders$ = Object.keys(loaders).map(loadableField => {
         const result$ = loaders[loadableField](state)
         if (!isObservable(result$))
            throw new Error(
               `Loader for value "${loadableField}" in vertex "${toVertexName(
                  vertexId
               )}" must return an observable, received "${result$}" instead.`
            )
         return result$.pipe(
            map(value => ({ fieldName: loadableField, value }))
         )
      })
      const load$ = merge(...loaders$)
      const loaded$ = load$.pipe(
         scan(
            (acc, loadedField: any) => ({
               ...acc,
               [loadedField.fieldName]: {
                  status: 'loaded',
                  value: loadedField.value,
                  errors: []
               }
            }),
            loadingFields
         )
      )

      const loadable$ = merge(loading$, loaded$)

      const transformable$ = loadable$.pipe(
         map(loadableFields =>
            enrichVertexFields(transformable, loadableFields)
         )
      )

      return transformable$
   })
