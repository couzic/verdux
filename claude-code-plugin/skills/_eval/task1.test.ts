import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { Observable, Subject } from 'rxjs'
import { expect } from 'chai'
import { configureRootVertex, createGraph, Graph, Vertex } from 'verdux'

// ---------------------------------------------------------------------------
// Dependency contract
// ---------------------------------------------------------------------------

interface User {
   id: string
   name: string
}

interface ApiClient {
   getUser: (id: string) => Observable<User>
}

// The real factory would build a concrete client (e.g. backed by ajax). Its
// shape is all the graph cares about; tests inject a fake in its place.
const createApiClient = (): ApiClient => ({
   getUser: (_id: string) => new Subject<User>().asObservable()
})

// ---------------------------------------------------------------------------
// Root vertex — empty slice, dependency well holding the apiClient
// ---------------------------------------------------------------------------

const rootSlice = createSlice({
   name: 'root',
   initialState: {},
   reducers: {}
})

const rootVertexConfig = configureRootVertex({
   slice: rootSlice,
   dependencies: {
      apiClient: createApiClient
   }
})

// ---------------------------------------------------------------------------
// Downstream vertex (tree-first, single parent via configureDownstreamVertex)
// Owns `userId` and loads `user` from it whenever it changes.
// ---------------------------------------------------------------------------

interface UserState {
   userId: string
}

const userSlice = createSlice({
   name: 'user',
   initialState: { userId: '' } as UserState,
   reducers: {
      userIdChanged: (state, action: PayloadAction<string>) => {
         state.userId = action.payload
      }
   }
})

export const userActions = userSlice.actions

export const userVertexConfig = rootVertexConfig
   .configureDownstreamVertex({ slice: userSlice })
   // The child inherits the root's entire dependency object automatically, so
   // apiClient is available here without listing it anywhere.
   .withDependencies(({ apiClient }, vertex) =>
      // loadFromFields is the cascade-load primitive: re-run the loader (and
      // produce the loadable `user` field) whenever `userId` changes.
      vertex.loadFromFields(['userId'], {
         user: ({ userId }) => apiClient.getUser(userId)
      })
   )

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

describe('userVertex', () => {
   let graph: Graph
   let vertex: Vertex<typeof userVertexConfig>
   let getUser$: Subject<User>

   beforeEach(() => {
      getUser$ = new Subject<User>()
      const fakeApiClient: ApiClient = {
         getUser: () => getUser$.asObservable()
      }
      graph = createGraph({
         vertices: [
            rootVertexConfig.injectedWith({ apiClient: fakeApiClient }),
            userVertexConfig
         ]
      })
      vertex = graph.getVertexInstance(userVertexConfig)
   })

   it('loads the user when userId changes and the service emits', () => {
      graph.dispatch(userActions.userIdChanged('u1'))

      // Before the service emits, the user field is still loading.
      expect(vertex.currentLoadableState.status).to.equal('loading')

      const user: User = { id: 'u1', name: 'Ada' }
      getUser$.next(user)

      expect(vertex.currentLoadableState.status).to.equal('loaded')
      expect(vertex.currentState.user).to.deep.equal(user)
   })
})
