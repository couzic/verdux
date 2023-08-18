import { PayloadAction, createSlice } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { Graph } from '../../Graph'
import { createGraph } from '../../createGraph'
import { configureRootVertex } from '../../configureRootVertex'

describe('rootVertex.computeFromFields()', () => {

  let graph: Graph
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
    .computeFromFields(['username'], {
      lowercaseUsername: ({ username }) => username.toLowerCase()
    })
  beforeEach(() => {
    graph = createGraph({
      vertices: [rootVertexConfig],
    })
  })
  it('creates simplest vertex', () => {
    const rootVertex = graph.getInstance(rootVertexConfig)
    expect(rootVertex.currentState.username).to.equal('')
    expect(rootVertex.currentState.lowercaseUsername).to.equal('')
  })
  it('updates vertex state', () => {
    const rootVertex = graph.getInstance(rootVertexConfig)
    rootVertex.dispatch(slice.actions.setUsername('NeW nAmE'))
    expect(rootVertex.currentState.username).to.equal('NeW nAmE')
    expect(rootVertex.currentState.lowercaseUsername).to.equal('new name')
  })

})