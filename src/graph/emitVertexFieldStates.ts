import { Observable, Subject, map, scan } from 'rxjs'
import { VertexFieldState } from '../state/VertexFieldState'
import { compareFields } from '../state/compareFields'
import { VertexId } from '../vertex/VertexId'
import { GraphData } from './GraphData'

type SCAN_SEED = 'SCAN_SEED'

type FieldsByVertexId = Record<VertexId, Record<string, VertexFieldState>>

export const emitVertexFieldStates = (
   graphData$: Observable<GraphData>,
   vertexFieldStatesStreamById: Record<
      VertexId,
      Subject<Record<string, VertexFieldState>>
   >,
   // TODO Make sure vertexIds are listed in the same order than transformations
   vertexIds: VertexId[]
) => {
   graphData$
      .pipe(
         map(graphData => {
            const fieldsByVertexId: FieldsByVertexId = {}
            vertexIds.forEach(vertexId => {
               const fields = {} as Record<string, VertexFieldState>

               const reduxFieldsData =
                  graphData.vertices[vertexId].reduxState.vertex
               const reduxFieldNames = Object.keys(reduxFieldsData)
               reduxFieldNames.forEach(reduxFieldName => {
                  fields[reduxFieldName] = {
                     value: reduxFieldsData[reduxFieldName],
                     status: 'loaded',
                     errors: []
                  }
               })

               const fieldsData = graphData.vertices[vertexId].fields
               const fieldNames = Object.keys(fieldsData)
               fieldNames.forEach(fieldName => {
                  const field = fieldsData[fieldName]
                  fields[fieldName] = {
                     value: field.value,
                     status: field.status,
                     errors: field.errors
                  }
               })
               fieldsByVertexId[vertexId] = fields
            })
            return fieldsByVertexId
         }),
         scan(
            (
               previous:
                  | SCAN_SEED
                  | {
                       fieldsByVertexId: FieldsByVertexId
                       changedVertexIds: VertexId[]
                    },
               fieldsByVertexId
            ) => {
               const fieldsHaveChanged =
                  previous === 'SCAN_SEED'
                     ? () => true
                     : (vertexId: VertexId) => {
                          const previousFields =
                             previous.fieldsByVertexId[vertexId]
                          const currentFields = fieldsByVertexId[vertexId]
                          return !compareFields(previousFields, currentFields)
                       }
               const changedVertexIds: VertexId[] = []
               vertexIds.forEach(vertexId => {
                  if (fieldsHaveChanged(vertexId)) {
                     changedVertexIds.push(vertexId)
                  }
               })
               return { fieldsByVertexId, changedVertexIds }
            },
            'SCAN_SEED'
         )
      )
      .subscribe(scanResult => {
         if (scanResult === 'SCAN_SEED') return
         const { changedVertexIds, fieldsByVertexId } = scanResult
         // TODO vertices.next(...) IN SAME ORDER THAN TRANSFORMATIONS
         changedVertexIds.forEach(vertexId => {
            const fieldStates$ = vertexFieldStatesStreamById[vertexId]
            fieldStates$.next(fieldsByVertexId[vertexId])
         })
      })
}
