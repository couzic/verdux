import { PayloadAction, createSlice } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { NEVER, Subject, of } from 'rxjs'
import { stub } from 'sinon'
import { Graph } from '../../Graph'
import { Vertex } from '../../Vertex'
import { configureRootVertex } from '../../config/configureRootVertex'
import { createGraph } from '../../createGraph'

const createUserService = () => ({
   getLoggedUser: () => of('DEFAULT'),
   getUserId: () => of('DEFAULT'),
   getUsernameById: (id: string) => of('DEFAULT')
})
type UserService = ReturnType<typeof createUserService>

describe('downstreamVertex loadFromFields from loadable field', () => {
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
   const slice = createSlice({
      name: 'downstreamVertexName',
      initialState: { whatever: 'nevermind' },
      reducers: {
         whateverValueChanged: (state, action: PayloadAction<string>) => {
            state.whatever = action.payload
         }
      }
   })
   const vertexConfig = rootVertexConfig
      .configureDownstreamVertex({
         slice
      })
      .load(({ userService }) => ({ userId: userService.getUserId() }))
      .loadFromFields(['userId'], ({ userService }) => ({
         username: ({ userId }) => userService.getUsernameById(userId)
      }))
      .fieldsReaction(['userId'], ({ userId }) =>
         slice.actions.whateverValueChanged(userId)
      )
   let graph: Graph
   let vertex: Vertex<typeof vertexConfig>
   let userService: UserService
   let receivedLoggedUser$: Subject<string>
   let receivedUserId$: Subject<string>
   let receivedUser$: Subject<string>
   beforeEach(() => {
      receivedLoggedUser$ = new Subject()
      receivedUserId$ = new Subject()
      receivedUser$ = new Subject()
      userService = {
         getLoggedUser: stub().returns(receivedLoggedUser$),
         getUserId: stub().returns(receivedUserId$),
         getUsernameById: stub().returns(receivedUser$)
      }
      const deepDownstreamVertexConfig = vertexConfig
         .configureDownstreamVertex({
            slice: createSlice({
               name: 'deepDownstream',
               initialState: {},
               reducers: {}
            }),
            upstreamFields: ['username']
         })
         .loadFromFields(['username'], {
            theUsername: ({ username }) => of(username)
         })
         .computeFromFields(['username'], {
            uppercaseUsername: ({ username }) => username.toUpperCase()
         })
      graph = createGraph({
         vertices: [
            rootVertexConfig.injectedWith({ userService }),
            vertexConfig,
            deepDownstreamVertexConfig
         ]
      })
      vertex = graph.getVertexInstance(vertexConfig)
   })
   it('is initially loading', () => {
      expect(userService.getUserId).to.have.been.calledOnce
      expect(vertex.currentLoadableState.status).to.equal('loading')
      expect(userService.getUsernameById).not.to.have.been.called
   })
   describe('when user id received', () => {
      beforeEach(() => {
         receivedUserId$.next('123')
      })
      it('it is still loading', () => {
         expect(vertex.currentLoadableState.status).to.equal('loading')
         expect(userService.getUsernameById).to.have.been.calledOnceWithExactly(
            '123'
         )
      })
      describe('when user received', () => {
         beforeEach(() => {
            receivedUser$.next('Bob')
         })
         it('is loaded', () => {
            expect(vertex.currentLoadableState.status).to.equal('loaded')
         })
         describe('when irrelevant field updated', () => {
            beforeEach(() => {
               graph.dispatch(
                  slice.actions.whateverValueChanged('some new value')
               )
            })
            it('does not refetch user', () => {
               expect(
                  userService.getUsernameById
               ).to.have.been.calledOnceWithExactly('123')
            })
         })
         describe('when same user id received', () => {
            beforeEach(() => {
               receivedUserId$.next('123')
            })
            it('does not refetch user', () => {
               expect(userService.getUsernameById).to.have.been.calledOnce
            })
         })
      })
   })
})
