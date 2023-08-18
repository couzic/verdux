import { PayloadAction, createAction, createReducer, createSlice } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { Graph } from '../../Graph'
import { createGraph } from '../../createGraph'
import { configureRootVertex } from '../../configureRootVertex'

describe('Downstream vertex', () => {

  const rootSlice = createSlice({
    name: 'root',
    initialState: { username: '' },
    reducers: {}
  })
  const downstreamSlice = createSlice({
    name: 'ds',
    initialState: { friend: '' },
    reducers: {
      setFriend: (state, action: PayloadAction<string>) => { state.friend = action.payload }
    }
  })

  describe('from slice', () => {
    const rootVertexConfig = configureRootVertex({
      slice: rootSlice
    })
    const downstreamVertexConfig = rootVertexConfig.configureDownstreamVertex({
      slice: downstreamSlice
    })
    const deepDownstreamSlice = createSlice({
      name: 'deep',
      initialState: { otherFriend: '' },
      reducers: {
        setOtherFriend: (state, action: PayloadAction<string>) => { state.otherFriend = action.payload }
      }
    })
    const deepDownstreamVertexConfig = downstreamVertexConfig.configureDownstreamVertex({
      slice: deepDownstreamSlice
    })
    let graph: Graph
    it('creates graph without specifying upstream vertex configs', () => {
      const graph = createGraph({ vertices: [deepDownstreamVertexConfig] })
      const deepVertex = graph.getInstance(deepDownstreamVertexConfig)
      expect(deepVertex.currentState.otherFriend).to.equal('')
    })
    beforeEach(() => {
      graph = createGraph({
        vertices: [rootVertexConfig, downstreamVertexConfig, deepDownstreamVertexConfig]
      })
    })
    it('creates deep downstream vertex', () => {
      const deepDownsteamVertex = graph.getInstance(deepDownstreamVertexConfig)
      expect(deepDownsteamVertex.currentState.otherFriend).to.equal('')
    })
    it('updates deep downstream vertex', () => {
      const deepDownsteamVertex = graph.getInstance(deepDownstreamVertexConfig)
      deepDownsteamVertex.dispatch(deepDownstreamSlice.actions.setOtherFriend('new other friend'))
      expect(deepDownsteamVertex.currentState.otherFriend).to.equal('new other friend')
    })
  })

  describe('from reducer', () => {
    const rootVertexConfig = configureRootVertex({
      slice: rootSlice
    })
    const downstreamVertexConfig = rootVertexConfig.configureDownstreamVertex({
      slice: downstreamSlice
    })
    const setOtherFriend = createAction<string>('setOtherFriend')
    const deepDownstreamReducer = createReducer({ otherFriend: '' }, builder => builder.addCase(setOtherFriend, (state, action) => { state.otherFriend = action.payload }))
    const deepDownstreamVertexConfig = downstreamVertexConfig.configureDownstreamVertex({
      name: 'deep',
      reducer: deepDownstreamReducer
    })
    let graph: Graph
    beforeEach(() => {
      graph = createGraph({
        vertices: [rootVertexConfig, downstreamVertexConfig, deepDownstreamVertexConfig]
      })
    })
    it('creates downstream vertex', () => {
      const deepDownsteamVertex = graph.getInstance(deepDownstreamVertexConfig)
      expect(deepDownsteamVertex.currentState.otherFriend).to.equal('')
    })
    it('updates downstream vertex', () => {
      const deepDownsteamVertex = graph.getInstance(deepDownstreamVertexConfig)
      deepDownsteamVertex.dispatch(setOtherFriend('new other friend'))
      expect(deepDownsteamVertex.currentState.otherFriend).to.equal('new other friend')
    })
  })

})
