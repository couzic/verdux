import { PayloadAction, createSlice } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { configureRootVertex } from '../config/configureRootVertex'
import { createGraph } from './createGraph'

describe(createGraph.name, () => {
   describe('single root vertex', () => {
      const rootVertexConfig = configureRootVertex({
         slice: createSlice({
            name: 'root',
            initialState: {
               name: ''
            },
            reducers: {
               setName: (state, action: PayloadAction<string>) => {
                  state.name = action.payload
               }
            }
         })
      })
      let latestState: any
      let latestLoadableState: any
      let latestPick: any
      it('creates graph', () => {
         const graph = createGraph({
            vertices: [rootVertexConfig]
         })
         const rootVertex = graph.getVertexInstance(rootVertexConfig)
         rootVertex.state$.subscribe(state => {
            latestState = state
         })
         rootVertex.loadableState$.subscribe(loadableState => {
            latestLoadableState = loadableState
         })
         rootVertex.pick(['name']).subscribe(pick => {
            latestPick = pick
         })
         expect(rootVertex.id).to.equal(rootVertexConfig.id)
         expect(rootVertex.currentState).to.deep.equal({ name: '' })
         const expectedLoadableState = {
            status: 'loaded',
            errors: [],
            state: { name: '' },
            fields: {
               name: {
                  status: 'loaded',
                  value: '',
                  errors: []
               }
            }
         }
         expect(rootVertex.currentLoadableState).to.deep.equal(
            expectedLoadableState
         )
         expect(latestState).to.deep.equal({ name: '' })
         expect(latestLoadableState).to.deep.equal(expectedLoadableState)
         expect(latestPick).to.deep.equal(expectedLoadableState)
      })
   })
})
