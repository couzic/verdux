import { expect } from 'chai'
import { Observable, Subject, of } from 'rxjs'
import { createVertexId } from '../config/createVertexId'
import { VertexFieldState } from '../state/VertexFieldState'
import { GraphTransformable } from './Transformable'
import { emitVertexFieldStates } from './emitVertexFieldStates'

describe(emitVertexFieldStates.name, () => {
   const vertexId = createVertexId('vertex')
   it('emits fields from redux state', () => {
      const graphTransformable$: Observable<GraphTransformable> = of({
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

      emitVertexFieldStates(
         graphTransformable$,
         { [vertexId]: vertexFieldState$ },
         [vertexId]
      )
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
      const graphTransformable$ = new Subject<GraphTransformable>()
      emitVertexFieldStates(graphTransformable$, { [vertexId]: vertexState$ }, [
         vertexId
      ])
      ;[1, 2].forEach(() =>
         graphTransformable$.next({
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
      const graphTransformable$ = of({
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

      emitVertexFieldStates(graphTransformable$, { [vertexId]: vertexState$ }, [
         vertexId
      ])
      expect(stateEmissions).to.equal(1)
      expect(latestState).to.deep.equal({
         name: { status: 'loaded', value: 'Bob', errors: [] }
      })
   })
})
