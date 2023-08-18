import { PayloadAction, createAction, createReducer, createSlice } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { Graph } from '../../Graph'
import { createGraph } from '../../createGraph'
import { configureRootVertex } from '../../configureRootVertex'

describe('rootVertex reducers', () => {

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
    beforeEach(() => {
      graph = createGraph({
        vertices: [rootVertexConfig],
      })
    })
    it('creates simplest vertex', () => {
      const rootVertex = graph.getInstance(rootVertexConfig)
      expect(rootVertex.currentState.username).to.equal('')
    })
    it('updates vertex state', () => {
      const rootVertex = graph.getInstance(rootVertexConfig)
      rootVertex.dispatch(slice.actions.setUsername('new name'))
      expect(rootVertex.currentState.username).to.equal('new name')
    })
  })

  describe('from reducer', () => {
    const setUsername = createAction<string>('setUsername')
    const reducer = createReducer({ username: '' }, builder => builder.addCase(setUsername, (state, action) => { state.username = action.payload }))
    const rootVertexConfig = configureRootVertex({
      name: 'root',
      reducer
    })
    beforeEach(() => {
      graph = createGraph({
        vertices: [rootVertexConfig],
      })
    })
    it('creates simplest vertex', () => {
      const rootVertex = graph.getInstance(rootVertexConfig)
      expect(rootVertex.currentState.username).to.equal('')
    })
    it('updates vertex state', () => {
      const rootVertex = graph.getInstance(rootVertexConfig)
      rootVertex.dispatch(setUsername('new name'))
      expect(rootVertex.currentState.username).to.equal('new name')
    })
  })

})