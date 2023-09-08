import { createSlice } from '@reduxjs/toolkit'
import * as chai from 'chai'
import { Observable, Subject, of } from 'rxjs'
import { SinonStub, stub } from 'sinon'
import sinonChai from 'sinon-chai'
import { Graph } from '../../Graph'
import { Vertex } from '../../Vertex'
import { configureRootVertex } from '../../configureRootVertex'
import { createGraph } from '../../createGraph'

chai.use(sinonChai)
const { expect } = chai

describe('rootVertex.loadFromStream()', () => {
   let usernameSubject = new Subject<string>()
   const slice = createSlice({
      name: 'root',
      initialState: {},
      reducers: {}
   })
   const rootVertexConfig = configureRootVertex({
      slice,
      dependencies: {
         userProfileService: () => ({
            getUserProfile: (username: string) => of({ name: username })
         }),
         username$: () => usernameSubject as Observable<string>
      }
   }).loadFromStream(
      deps => deps.username$,
      ({ userProfileService }) => ({
         userProfile: username => userProfileService.getUserProfile(username)
      })
   )
   let graph: Graph
   let rootVertex: Vertex<typeof rootVertexConfig>

   describe('when using default dependency provider', () => {
      beforeEach(() => {
         usernameSubject = new Subject()
         graph = createGraph({
            vertices: [rootVertexConfig]
         })
         rootVertex = graph.getVertexInstance(rootVertexConfig)
      })
      it('is initially loading', () => {
         usernameSubject.subscribe(console.log)
         expect(rootVertex.currentLoadableState.status).to.equal('loading')
      })
      describe('when an input is received', () => {
         beforeEach(() => {
            usernameSubject.next('initial name')
         })
         it('loads from initial value', () => {
            expect(rootVertex.currentState.userProfile).to.deep.equal({
               name: 'initial name'
            })
         })
         describe('when another input is received', () => {
            beforeEach(() => {
               usernameSubject.next('new name')
            })
            it('loads from updated value', () => {
               expect(rootVertex.currentState.userProfile).to.deep.equal({
                  name: 'new name'
               })
            })
         })
      })
   })

   describe('when injecting dependency', () => {
      let receivedUserProfile$: Subject<{ name: string }>
      let userProfileService: {
         getUserProfile: (name: string) => Observable<{ name: string }>
      }
      beforeEach(() => {
         usernameSubject = new Subject()
         receivedUserProfile$ = new Subject()
         userProfileService = {
            getUserProfile: stub().returns(receivedUserProfile$)
         }
         graph = createGraph({
            vertices: [rootVertexConfig.injectedWith({ userProfileService })]
         })
         rootVertex = graph.getVertexInstance(rootVertexConfig)
      })
      it('is initially loading', () => {
         expect(rootVertex.currentLoadableState.status).to.equal('loading')
         expect(
            rootVertex.currentLoadableState.loadableFields.userProfile.status
         ).to.equal('loading')
      })
      describe('when an input is received', () => {
         beforeEach(() => {
            usernameSubject.next('initial name')
         })
         it('loads from initial value', () => {
            expect(
               userProfileService.getUserProfile
            ).to.have.been.calledOnceWithExactly('initial name')
         })
         describe('when user profile is received', () => {
            beforeEach(() => {
               receivedUserProfile$.next({ name: 'initial name' })
            })
            it('is loaded', () => {
               expect(rootVertex.currentLoadableState.status).to.equal('loaded')
               expect(
                  rootVertex.currentLoadableState.loadableFields.userProfile
                     .status
               ).to.equal('loaded')
               expect(rootVertex.currentState.userProfile).to.deep.equal({
                  name: 'initial name'
               })
            })
            describe('when another input is received', () => {
               beforeEach(() => {
                  ;(
                     userProfileService.getUserProfile as SinonStub
                  ).resetHistory()
                  usernameSubject.next('new name')
               })
               it('loads from updated value', () => {
                  expect(rootVertex.currentLoadableState.status).to.equal(
                     'loading'
                  )
                  expect(
                     userProfileService.getUserProfile
                  ).to.have.been.calledOnceWithExactly('new name')
               })
               describe('when another user profile is received', () => {
                  beforeEach(() => {
                     receivedUserProfile$.next({ name: 'new name' })
                  })
                  it('is loaded', () => {
                     expect(rootVertex.currentState.userProfile).to.deep.equal({
                        name: 'new name'
                     })
                  })
               })
            })
         })
      })
   })
})
