import { expect } from 'chai'
import { createVertexId } from '../config/createVertexId'
import { GraphData } from './GraphData'
import { emitVertexFieldStates } from './emitVertexFieldStates'
import { Subject, of } from 'rxjs'
import { VertexFieldState } from '../state/VertexFieldState'

describe(emitVertexFieldStates.name, () => {
   const vertexId = createVertexId('vertex')
   it('emits fields from redux state', () => {
      const graphData$ = of({
         vertices: {
            [vertexId]: {
               reduxState: {
                  vertex: { name: 'Bob' },
                  downstream: {}
               },
               fields: {}
            }
         },
         fieldsReactions: [],
         reactions: []
      })
      const vertexFieldState$ = new Subject<Record<string, VertexFieldState>>()
      let stateEmissions = 0
      let latestState: any
      vertexFieldState$.subscribe(state => {
         stateEmissions++
         latestState = state
      })

      emitVertexFieldStates(graphData$, { [vertexId]: vertexFieldState$ }, [
         vertexId
      ])
      expect(stateEmissions).to.equal(1)
      expect(latestState).to.deep.equal({
         name: { status: 'loaded', value: 'Bob', errors: [] }
      })
   })

   it('does not emit two similar states ', () => {
      const vertexState$ = new Subject<Record<string, VertexFieldState>>()
      let stateEmissions = 0
      let latestState: any
      vertexState$.subscribe(state => {
         stateEmissions++
         latestState = state
      })
      const graphData$ = new Subject<GraphData>()
      emitVertexFieldStates(graphData$, { [vertexId]: vertexState$ }, [
         vertexId
      ])
      ;[1, 2].forEach(() =>
         graphData$.next({
            vertices: {
               [vertexId]: {
                  reduxState: {
                     vertex: { name: 'Bob' },
                     downstream: {}
                  },
                  fields: {}
               }
            },
            fieldsReactions: [],
            reactions: []
         })
      )
      expect(stateEmissions).to.equal(1)
   })

   it('emits fields from fields', () => {
      const graphData$ = of({
         vertices: {
            [vertexId]: {
               reduxState: {
                  vertex: {},
                  downstream: {}
               },
               fields: {
                  name: { status: 'loaded' as const, value: 'Bob', errors: [] }
               }
            }
         },
         fieldsReactions: [],
         reactions: []
      })
      const vertexState$ = new Subject<Record<string, VertexFieldState>>()
      let stateEmissions = 0
      let latestState: any
      vertexState$.subscribe(state => {
         stateEmissions++
         latestState = state
      })

      emitVertexFieldStates(graphData$, { [vertexId]: vertexState$ }, [
         vertexId
      ])
      expect(stateEmissions).to.equal(1)
      expect(latestState).to.deep.equal({
         name: { status: 'loaded', value: 'Bob', errors: [] }
      })
   })
})
