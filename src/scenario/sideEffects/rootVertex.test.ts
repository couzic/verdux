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
      },
      setSomethingElse: (state, action: PayloadAction<string>) => {}
   }
})
const { setUsername, setSomethingElse } = slice.actions

describe('rootVertex.sideEffect()', () => {
   let graph: Graph

   it('triggers side effect', () => {
      let result: string | undefined
      const rootVertexConfig = configureRootVertex({ slice }).sideEffect(
         setUsername,
         username => (result = username)
      )
      graph = createGraph({
         vertices: [rootVertexConfig]
      })
      graph.dispatch(setUsername('Bob'))
      expect(result).to.equal('Bob')
   })

   it('ignores side effect when another action is dispatched', () => {
      let result: string | undefined
      const rootVertexConfig = configureRootVertex({ slice }).sideEffect(
         setUsername,
         username => (result = username)
      )
      graph = createGraph({
         vertices: [rootVertexConfig]
      })
      graph.dispatch(setSomethingElse('Bob'))
      expect(result).to.equal(undefined)
   })
})
