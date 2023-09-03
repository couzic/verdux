import { PayloadAction, createSlice } from '@reduxjs/toolkit'
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

describe('rootVertex.loadFromFields()', () => {
   const slice = createSlice({
      name: 'root',
      initialState: { username: '', flag: false },
      reducers: {
         setUsername: (state, action: PayloadAction<string>) => {
            state.username = action.payload
         },
         setFlag: (state, action: PayloadAction<boolean>) => {
            state.flag = action.payload
         }
      }
   })
   const rootVertexConfig = configureRootVertex({
      slice,
      dependencies: {
         userProfileService: () => ({
            getUserProfile: (username: string) => of({ name: username })
         })
      }
   }).loadFromFields(['username'], {
      userProfile: (state, { userProfileService }) => {
         return userProfileService.getUserProfile(state.username)
      }
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
      it('loads from initial value', () => {
         expect(rootVertex.currentState.username).to.equal('')
         expect(rootVertex.currentState.userProfile).to.deep.equal({ name: '' })
      })
      it('loads from updated value', () => {
         graph.dispatch(slice.actions.setUsername('new name'))
         expect(rootVertex.currentState.userProfile).to.deep.equal({
            name: 'new name'
         })
      })
   })

   describe('when injecting dependency', () => {
      let receivedUserProfile$: Subject<{ name: string }>
      let userProfileService: {
         getUserProfile: (name: string) => Observable<{ name: string }>
      }
      beforeEach(() => {
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
      it('loads from initial value', () => {
         expect(
            userProfileService.getUserProfile
         ).to.have.been.calledOnceWithExactly('')
      })
      describe('when user profile is received', () => {
         beforeEach(() => {
            receivedUserProfile$.next({ name: '' })
         })
         it('is loaded', () => {
            expect(rootVertex.currentLoadableState.status).to.equal('loaded')
            expect(
               rootVertex.currentLoadableState.loadableFields.userProfile.status
            ).to.equal('loaded')
            expect(rootVertex.currentState.userProfile).to.deep.equal({
               name: ''
            })
         })
         describe('when another unrelated part of the state is updated', () => {
            beforeEach(() => {
               ;(userProfileService.getUserProfile as SinonStub).resetHistory()
               rootVertex.dispatch(slice.actions.setFlag(true))
            })
            it('does NOT load data again', () => {
               expect(rootVertex.currentState.flag).to.be.true
               expect(
                  rootVertex.currentLoadableState.loadableFields.userProfile
                     .status
               ).to.equal('loaded')
               expect(rootVertex.currentLoadableState.status).to.equal('loaded')
               expect(userProfileService.getUserProfile).not.to.have.been.called
            })
         })
         describe('when username changed', () => {
            beforeEach(() => {
               ;(userProfileService.getUserProfile as SinonStub).resetHistory()
               graph.dispatch(slice.actions.setUsername('bob'))
            })
            it('is loading again', () => {
               expect(rootVertex.currentState.username).to.equal('bob')
               expect(rootVertex.currentLoadableState.status).to.equal(
                  'loading'
               )
               expect(
                  rootVertex.currentLoadableState.loadableFields.userProfile
                     .status
               ).to.equal('loading')
            })
            it('loads from updated value', () => {
               expect(
                  userProfileService.getUserProfile
               ).to.have.been.calledOnceWithExactly('bob')
            })
            describe('when profile received', () => {
               beforeEach(() => {
                  receivedUserProfile$.next({ name: 'bob' })
               })
               it('is loaded', () => {
                  expect(rootVertex.currentLoadableState.status).to.equal(
                     'loaded'
                  )
                  expect(
                     rootVertex.currentLoadableState.loadableFields.userProfile
                        .status
                  ).to.equal('loaded')
                  expect(rootVertex.currentState.userProfile).to.deep.equal({
                     name: 'bob'
                  })
               })
            })
         })
      })
   })
})
