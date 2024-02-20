import { PayloadAction, createSlice } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { Subject, of } from 'rxjs'
import { stub } from 'sinon'
import { Graph } from '../../Graph'
import { Vertex } from '../../Vertex'
import { configureRootVertex } from '../../config/configureRootVertex'
import { createGraph } from '../../createGraph'

const createUserService = () => ({
   getLoggedUser: () => of('DEFAULT')
})
type UserService = ReturnType<typeof createUserService>

describe('downstream of load()', () => {
   const rootVertexConfig = configureRootVertex({
      slice: createSlice({
         name: 'root',
         initialState: {},
         reducers: {}
      }),
      dependencies: {
         userService: createUserService
      }
   }).load(({ userService }) => ({
      loggedUser: userService.getLoggedUser()
   }))
   const downstreamSlice = createSlice({
      name: 'downstreamVertexName',
      initialState: { input: '' },
      reducers: {
         inputValueChanged: (state, action: PayloadAction<string>) => {
            state.input = action.payload
         }
      }
   })
   const downstreamVertexConfig = rootVertexConfig.configureDownstreamVertex({
      slice: downstreamSlice
   })
   let graph: Graph
   let rootVertex: Vertex<typeof rootVertexConfig>
   let downstreamVertex: Vertex<typeof downstreamVertexConfig>
   let userService: UserService
   let receivedLoggedUser$: Subject<string>
   beforeEach(() => {
      receivedLoggedUser$ = new Subject()
      userService = {
         getLoggedUser: stub().returns(receivedLoggedUser$)
      }
      graph = createGraph({
         vertices: [
            rootVertexConfig.injectedWith({ userService }),
            downstreamVertexConfig
         ]
      })
      rootVertex = graph.getVertexInstance(rootVertexConfig)
      downstreamVertex = graph.getVertexInstance(downstreamVertexConfig)
   })
   it('is initially loading', () => {
      expect(userService.getLoggedUser).to.have.been.calledOnce
      expect(rootVertex.currentLoadableState.status).to.equal('loading')
   })
   describe('when downstream redux state updated', () => {
      beforeEach(() => {
         graph.dispatch(downstreamSlice.actions.inputValueChanged('new input'))
      })
      it('emits downstream redux state', () => {
         expect(downstreamVertex.currentState).to.deep.equal({
            input: 'new input'
         })
      })
      describe('when loaded value received', () => {
         beforeEach(() => {
            receivedLoggedUser$.next('Bob')
         })
         it('is loaded', () => {
            expect(rootVertex.currentLoadableState.status).to.equal('loaded')
         })
         it('keeps updated value in downstream redux state', () => {
            expect(downstreamVertex.currentState).to.deep.equal({
               input: 'new input'
            })
         })
      })
   })
})
