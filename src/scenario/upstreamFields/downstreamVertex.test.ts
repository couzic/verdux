import { PayloadAction, createSlice } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { Graph } from '../../Graph'
import { createGraph } from '../../createGraph'
import { configureRootVertex } from '../../configureRootVertex'

describe('downstreamVertex upstreamFields', () => {

  let graph: Graph
  const rootSlice = createSlice({
    name: 'root',
    initialState: { username: '' },
    reducers: {
      setUsername: (state, action: PayloadAction<string>) => {
        state.username = action.payload
      }
    }
  })
  const rootVertexConfig = configureRootVertex({
    slice: rootSlice
  })
  const downstreamSlice = createSlice({
    name: 'ds',
    initialState: {},
    reducers: {},
  })
  const downstreamVertexConfig = rootVertexConfig.configureDownstreamVertex({
    slice: downstreamSlice,
    upstreamFields: ['username']
  })
  beforeEach(() => {
    graph = createGraph({
      vertices: [rootVertexConfig, downstreamVertexConfig]
    })
  })
  it('receives upstream field value', () => {
    const downsteamVertex = graph.getInstance(downstreamVertexConfig)
    expect(downsteamVertex.currentState.username).to.equal('')
  })
  describe('when upstream field value changes', () => {
    beforeEach(() => {
      graph.dispatch(rootSlice.actions.setUsername('new name'))
    })
    it('receives updated value', () => {
      const downsteamVertex = graph.getInstance(downstreamVertexConfig)
      expect(downsteamVertex.currentState.username).to.equal('new name')
    })
  })
})

