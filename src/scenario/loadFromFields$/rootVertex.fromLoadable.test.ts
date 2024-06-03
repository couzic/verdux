import { createSlice } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { Observable, Subject, of, switchMap } from 'rxjs'
import { stub } from 'sinon'
import { Graph } from '../../Graph'
import { Vertex } from '../../Vertex'
import { configureRootVertex } from '../../config/configureRootVertex'
import { createGraph } from '../../createGraph'

describe('loadFromFields$ from loadable field', () => {
   const vertexConfig = configureRootVertex({
      slice: createSlice({ name: 'root', initialState: {}, reducers: {} }),
      dependencies: {
         userService: () => ({
            getUsername: () => of('Bob')
         }),
         greetingService: () => ({
            getGreeting: (name: string) => of('Hello, ' + name)
         })
      }
   })
      .load(({ userService }) => ({
         username: userService.getUsername()
      }))
      .loadFromFields$(['username'], ({ greetingService }) => ({
         greetings: switchMap(({ username }) =>
            greetingService.getGreeting(username)
         )
      }))
   let graph: Graph
   let vertex: Vertex<typeof vertexConfig>
   describe('with default dependencies', () => {
      beforeEach(() => {
         graph = createGraph({ vertices: [vertexConfig] })
         vertex = graph.getVertexInstance(vertexConfig)
      })
      it('loads greetings', () => {
         expect(vertex.currentLoadableState.status).to.equal('loaded')
         expect(vertex.currentState).to.deep.equal({
            username: 'Bob',
            greetings: 'Hello, Bob'
         })
      })
   })
   describe('with injected dependencies', () => {
      let receivedUsername$: Subject<string>
      let userService: { getUsername: () => Observable<string> }
      beforeEach(() => {
         receivedUsername$ = new Subject()
         userService = { getUsername: stub().returns(receivedUsername$) }
         graph = createGraph({
            vertices: [vertexConfig.injectedWith({ userService })]
         })
         vertex = graph.getVertexInstance(vertexConfig)
      })
      it('is initially loading', () => {
         expect(vertex.currentLoadableState.status).to.equal('loading')
         expect(
            vertex.currentLoadableState.loadableFields.greetings.status
         ).to.equal('loading')
      })
      describe('when username received', () => {
         beforeEach(() => {
            receivedUsername$.next('Bob')
         })
         it('is loaded', () => {
            expect(vertex.currentLoadableState.status).to.equal('loaded')
            expect(vertex.currentState).to.deep.equal({
               username: 'Bob',
               greetings: 'Hello, Bob'
            })
         })
      })
   })
})
