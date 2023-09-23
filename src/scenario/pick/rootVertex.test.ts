import { PayloadAction, createSlice } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { Observable } from 'rxjs'
import { Graph } from '../../Graph'
import { Vertex } from '../../Vertex'
import { VertexLoadableState } from '../../VertexLoadableState'
import { configureRootVertex } from '../../configureRootVertex'
import { createGraph } from '../../createGraph'

describe('rootVertex.pick()', () => {
   let graph: Graph

   describe('from slice', () => {
      const slice = createSlice({
         name: 'root',
         initialState: { username: '' },
         reducers: {
            setUsername: (state, action: PayloadAction<string>) => {
               state.username = action.payload
            }
         }
      })
      const rootVertexConfig = configureRootVertex({
         slice
      })
      let rootVertex: Vertex<typeof rootVertexConfig>
      let pickEmissions: number
      let pick$: Observable<VertexLoadableState<any>>
      let lastPicked: VertexLoadableState<any>
      beforeEach(() => {
         graph = createGraph({
            vertices: [rootVertexConfig]
         })
         rootVertex = graph.getVertexInstance(rootVertexConfig)
         pickEmissions = 0
         pick$ = rootVertex.pick(['username'])
         pick$.subscribe(picked => {
            pickEmissions++
            lastPicked = picked
         })
      })
      it('creates simplest vertex', () => {
         expect(rootVertex.currentState.username).to.equal('')
         expect(rootVertex.currentLoadableState.status).to.equal('loaded')
         expect(rootVertex.currentLoadableState.errors).to.deep.equal([])
      })
      it('picks field', () => {
         expect(pickEmissions).to.equal(1)
         expect(lastPicked.state).to.deep.equal({ username: '' })
      })
      describe('when username is updated', () => {
         beforeEach(() => {
            graph.dispatch(slice.actions.setUsername('new name'))
         })
         it('emits new state', () => {
            expect(pickEmissions).to.equal(2)
            expect(lastPicked.state).to.deep.equal({ username: 'new name' })
         })
      })
   })
})
