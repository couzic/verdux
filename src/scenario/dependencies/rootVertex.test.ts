import { PayloadAction, createSlice } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { Graph } from '../../Graph'
import { configureRootVertex } from '../../configureRootVertex'
import { createGraph } from '../../createGraph'

describe('rootVertex dependencies', () => {
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
      slice,
      dependencies: {
         usernameTransformer: () => (username: string) => username.toLowerCase()
      }
   }).computeFromFields(['username'], ({ usernameTransformer }) => ({
      transformedUsername: ({ username }) => usernameTransformer(username)
   }))
   let graph: Graph
   describe('when using default provider', () => {
      beforeEach(() => {
         graph = createGraph({
            vertices: [rootVertexConfig]
         })
      })
      it('uses default dependency', () => {
         const rootVertex = graph.getVertexInstance(rootVertexConfig)
         rootVertex.dispatch(slice.actions.setUsername('NeW nAmE'))
         expect(rootVertex.currentState.username).to.equal('NeW nAmE')
         expect(rootVertex.currentState.transformedUsername).to.equal(
            'new name'
         )
      })
   })
   describe('when injecting dependency', () => {
      beforeEach(() => {
         graph = createGraph({
            vertices: [
               rootVertexConfig.injectedWith({
                  usernameTransformer: name => name.toUpperCase()
               })
            ]
         })
      })
      it('uses injected dependency', () => {
         const rootVertex = graph.getVertexInstance(rootVertexConfig)
         rootVertex.dispatch(slice.actions.setUsername('NeW nAmE'))
         expect(rootVertex.currentState.username).to.equal('NeW nAmE')
         expect(rootVertex.currentState.transformedUsername).to.equal(
            'NEW NAME'
         )
      })
   })
})
