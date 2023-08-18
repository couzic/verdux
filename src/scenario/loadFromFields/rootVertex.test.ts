import { PayloadAction, createSlice } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { Observable, Subject, of } from 'rxjs'
import { stub } from 'sinon'
import { Graph } from '../../Graph'
import { Vertex } from '../../Vertex'
import { configureRootVertex } from '../../configureRootVertex'
import { createGraph } from '../../createGraph'

describe('rootVertex.loadFromFields()', () => {

  const slice = createSlice({
    name: 'root',
    initialState: { username: '' },
    reducers: {
      setUsername: (state, action: PayloadAction<string>) => {
        state.username = action.payload
      }
    },
  })
  const rootVertexConfig = configureRootVertex({
    slice,
    dependencies: {
      userProfileService: () => ({
        getUserProfile: (username: string) => of({ name: username })
      })
    }
  })
    .loadFromFields(['username'], {
      userProfile: (state, { userProfileService }) => {
        return userProfileService.getUserProfile(state.username)
      }
    })
  let graph: Graph
  describe('when using default dependency provider', () => {
    beforeEach(() => {
      graph = createGraph({
        vertices: [rootVertexConfig],
      })
    })
    it('loads from initial value', () => {
      const rootVertex = graph.getInstance(rootVertexConfig)
      expect(rootVertex.currentState.username).to.equal('')
      expect(rootVertex.currentState.userProfile).to.deep.equal({ name: '' })
    })
    it('loads from updated value', () => {
      const rootVertex = graph.getInstance(rootVertexConfig)
      graph.dispatch(slice.actions.setUsername('new name'))
      expect(rootVertex.currentState.userProfile).to.deep.equal({ name: 'new name' })
    })
  })

  describe('when injecting dependency', () => {
    let receivedUserProfile$: Subject<{ name: string }>
    let userProfileService: { getUserProfile: (name: string) => Observable<{ name: string }> }
    let rootVertex: Vertex<typeof rootVertexConfig>
    beforeEach(() => {
      receivedUserProfile$ = new Subject()
      userProfileService = { getUserProfile: stub().returns(receivedUserProfile$) }
      graph = createGraph({
        vertices: [rootVertexConfig.injectedWith({ userProfileService })],
      })
      rootVertex = graph.getInstance(rootVertexConfig)
    })
    it('is initially loading', () => {
      console.log(rootVertex.currentInternalState)
    })
    // it('loads from initial value', () => {
    //   const rootVertex = graph.getInstance(rootVertexConfig)
    //   expect(rootVertex.currentState.username).to.equal('')
    //   expect(rootVertex.currentState.userProfile).to.deep.equal({ name: '' })
    // })
    // it('loads from updated value', () => {
    //   const rootVertex = graph.getInstance(rootVertexConfig)
    //   graph.dispatch(slice.actions.setUsername('new name'))
    //   expect(rootVertex.currentState.userProfile).to.deep.equal({ name: 'new name' })
    // })
  })

})