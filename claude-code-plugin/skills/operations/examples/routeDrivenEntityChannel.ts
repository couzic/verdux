import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { EMPTY, Observable, map, of, switchMap } from 'rxjs'
import { configureRootVertex } from 'verdux'

// ---------------------------------------------------------------------------
// The route-driven entity + realtime channel — the composition the skills
// describe only in pieces. ONE route-derived `id | null` drives BOTH the
// entity `load` AND the realtime socket, and the "leave" signal is structural:
// a route without the param yields `null`, which clears the entity and closes
// the socket. There is no React useEffect/unmount anywhere in the lifecycle.
//
// The single impure seam is a bootstrap subscription that turns the router's
// route params into one dispatched action, `routeEntityChanged(id | null)`
// (`routeParams$` is the adapter from verdux:dependency-injection):
//
//   routeParams$(router).pipe(
//      map(params => params?.id ?? null),   // no param on this route → null
//      distinctUntilChanged()
//   ).subscribe(id => graph.dispatch(routeEntityChanged(id)))
//
// Everything below is pure and testable by dispatching that action directly —
// no router, no MemoryRouter (see verdux:testing, "No router in vertex tests").
//
// Why bridge the route to an ACTION rather than `load` it as a value-stream?
// Because the SAME signal must also drive a `reaction$` (the channel), and
// reactions key on actions, not on fields. One action feeds both the entity
// load and the channel, so there is a SINGLE source of "which entity am I on"
// (see verdux:graph-design, "Don't source the same value through two paths").
// ---------------------------------------------------------------------------

export interface Entity {
   id: string
   name: string
}

// A server event off the socket, and the two dependencies this vertex owns.
export interface ServerEvent {
   type: 'renamed' | 'ended'
   name?: string
}
export interface ApiClient {
   getEntity: (id: string) => Observable<Entity | null>
}
export interface Sse {
   open: (id: string) => Observable<ServerEvent>
}

interface LiveEntityState {
   currentId: string | null
   // `ended` is EVENT-ONLY: set only by a server 'ended' event, never rebuilt
   // from a snapshot/reconnect. That is exactly why its reset must follow
   // navigation (`routeEntityChanged(null)`), never a component unmount — a
   // lifecycle-driven close would wipe state the reconnect can't restore. Bind
   // the reset to the route, not to React's mount/unmount.
   ended: boolean
   liveName: string | null
}

const slice = createSlice({
   name: 'liveEntity',
   initialState: {
      currentId: null,
      ended: false,
      liveName: null
   } as LiveEntityState,
   reducers: {
      // The one route-derived action: sets the single source of truth for the
      // current id AND (via the reaction$ below) opens / re-keys / closes the
      // socket. Entering a fresh entity resets the event-only fields.
      routeEntityChanged: (state, action: PayloadAction<string | null>) => {
         state.currentId = action.payload
         state.ended = false
         state.liveName = null
      },
      renamed: (state, action: PayloadAction<string>) => {
         state.liveName = action.payload
      },
      ended: state => {
         state.ended = true
      }
   }
})

export const liveEntityActions = slice.actions
const { routeEntityChanged, renamed, ended } = slice.actions

// Fan the heterogeneous socket stream out into the slice actions that handle
// each server event — they re-dispatch through the store like any other.
const toAction = (e: ServerEvent) =>
   e.type === 'renamed' ? renamed(e.name!) : ended()

const rootVertexConfig = configureRootVertex({
   slice: createSlice({ name: 'root', initialState: {}, reducers: {} })
})

export const liveEntityVertexConfig = rootVertexConfig
   // `apiClient` and `sse` are consumed only here, so they are scoped to this
   // vertex rather than hoisted to the root well. The default factories make
   // the file self-contained; tests inject Subject-backed fakes.
   .configureDownstreamVertex({
      slice,
      dependencies: {
         apiClient: (): ApiClient => ({ getEntity: () => of(null) }),
         sse: (): Sse => ({ open: () => EMPTY })
      }
   })
   .withDependencies(({ apiClient, sse }, vertex) =>
      vertex
         // The entity load reads the SINGLE source. A `null` id → no entity;
         // loadFromFields re-runs on every `currentId` change, so navigating to
         // a new id cancels the in-flight fetch for the previous one.
         .loadFromFields(['currentId'], {
            entity: ({ currentId }) =>
               currentId == null ? of(null) : apiClient.getEntity(currentId)
         })
         // The channel keyed on the SAME action. switchMap makes the socket
         // follow the id: a new id closes the previous socket before opening
         // the next; `null` (navigate-away) maps to EMPTY, so the socket closes
         // and nothing opens. No separate `closed` action, no useEffect — the
         // single `id | null` action folds open, re-key, and close together.
         .reaction$(routeEntityChanged, in$ =>
            in$.pipe(
               switchMap(({ payload: id }) =>
                  id == null ? EMPTY : sse.open(id).pipe(map(toAction))
               )
            )
         )
   )
