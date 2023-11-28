import { PayloadAction, createSlice } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { Graph } from '../../Graph'
import { configureRootVertex } from '../../config/configureRootVertex'
import { createGraph } from '../../createGraph'

const slice = createSlice({
   name: 'root',
   initialState: { username: '', count: 0 },
   reducers: {
      setUsername: (state, action: PayloadAction<string>) => {
         state.username = action.payload
      }
   }
})
const { setUsername } = slice.actions

describe('rootVertex.sideEffect()', () => {
   let graph: Graph
   let result: string

   describe('with simple side effect', () => {
      const rootVertexConfig = configureRootVertex({ slice }).sideEffect(
         setUsername,
         username => (result = username)
      )
      beforeEach(() => {
         graph = createGraph({
            vertices: [rootVertexConfig]
         })
      })
      describe('when action dispatched', () => {
         beforeEach(() => {
            graph.dispatch(setUsername('Bob'))
         })
         it('triggers side effect', () => {
            expect(result).to.equal('Bob')
         })
      })
   })
})
