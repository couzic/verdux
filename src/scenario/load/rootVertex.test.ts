import { createSlice } from '@reduxjs/toolkit'
import * as chai from 'chai'
import { Observable, Subject, of } from 'rxjs'
import { stub } from 'sinon'
import sinonChai from 'sinon-chai'
import { Graph } from '../../Graph'
import { Vertex } from '../../Vertex'
import { configureRootVertex } from '../../configureRootVertex'
import { createGraph } from '../../createGraph'

chai.use(sinonChai)
const { expect } = chai

describe('rootVertex.load()', () => {
   const slice = createSlice({
      name: 'root',
      initialState: {},
      reducers: {}
   })
   const rootVertexConfig = configureRootVertex({
      slice,
      dependencies: {
         userService: () => ({
            getLoggedInUser: () => of({ name: 'bob' })
         })
      }
   }).load({
      user: deps => deps.userService.getLoggedInUser()
   })
   let graph: Graph
   let rootVertex: Vertex<typeof rootVertexConfig>

   describe('when using default dependency provider', () => {
      beforeEach(() => {
         graph = createGraph({
            vertices: [rootVertexConfig]
         })
         rootVertex = graph.getVertexInstance(rootVertexConfig)
      })
      it('loads value', () => {
         expect(rootVertex.currentState.user).to.deep.equal({ name: 'bob' })
      })
   })

   describe('when injecting dependency', () => {
      let receivedLoggedInUser$: Subject<{ name: string }>
      let userService: {
         getLoggedInUser: () => Observable<{ name: string }>
      }
      beforeEach(() => {
         receivedLoggedInUser$ = new Subject()
         userService = {
            getLoggedInUser: stub().returns(receivedLoggedInUser$)
         }
         graph = createGraph({
            vertices: [rootVertexConfig.injectedWith({ userService })]
         })
         rootVertex = graph.getVertexInstance(rootVertexConfig)
      })
      it('is initially loading', () => {
         expect(rootVertex.currentLoadableState.status).to.equal('loading')
         expect(
            rootVertex.currentLoadableState.loadableFields.user.status
         ).to.equal('loading')
      })
      it('loads from initial value', () => {
         expect(userService.getLoggedInUser).to.have.been.calledOnce
      })
      describe('when user profile is received', () => {
         beforeEach(() => {
            receivedLoggedInUser$.next({ name: '' })
         })
         it('is loaded', () => {
            expect(rootVertex.currentLoadableState.status).to.equal('loaded')
            expect(
               rootVertex.currentLoadableState.loadableFields.user.status
            ).to.equal('loaded')
            expect(rootVertex.currentState.user).to.deep.equal({
               name: ''
            })
         })
      })
   })
})
