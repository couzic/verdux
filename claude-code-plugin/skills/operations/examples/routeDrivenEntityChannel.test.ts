import { expect } from 'chai'
import { Observable, Subject } from 'rxjs'
import { createGraph, Graph, Vertex } from 'verdux'
import {
   ApiClient,
   Entity,
   liveEntityActions,
   liveEntityVertexConfig,
   ServerEvent,
   Sse
} from './routeDrivenEntityChannel'

// ---------------------------------------------------------------------------
// The whole route → entity + channel lifecycle as a DETERMINISTIC dispatch →
// assert script — the proof of verdux's core value (see verdux:testing). The
// real-world version of this bug looped for ages on flaky E2E; as a vertex
// test it is instant and reliable. No router, no MemoryRouter: dispatch the
// action the route adapter WOULD produce (`routeEntityChanged(id | null)`).
// ---------------------------------------------------------------------------

describe('route-driven entity + realtime channel', () => {
   let graph: Graph
   let vertex: Vertex<typeof liveEntityVertexConfig>

   // Track socket open/close ordering and per-id event subjects.
   let opened: string[]
   let closed: string[]
   let sockets: Record<string, Subject<ServerEvent>>
   // The entity loaders, newest last (loadFromFields re-runs per currentId).
   let entityLoads: Subject<Entity | null>[]

   beforeEach(() => {
      opened = []
      closed = []
      sockets = {}
      entityLoads = []

      const fakeSse: Sse = {
         open: (id: string) =>
            new Observable<ServerEvent>(subscriber => {
               opened.push(id)
               const subject = (sockets[id] = new Subject<ServerEvent>())
               const inner = subject.subscribe(subscriber)
               return () => {
                  closed.push(id) // teardown = the socket closes
                  inner.unsubscribe()
               }
            })
      }
      const fakeApi: ApiClient = {
         getEntity: () => {
            const load$ = new Subject<Entity | null>()
            entityLoads.push(load$)
            return load$
         }
      }

      graph = createGraph({
         vertices: [
            liveEntityVertexConfig.injectedWith({
               apiClient: fakeApi,
               sse: fakeSse
            })
         ]
      })
      vertex = graph.getVertexInstance(liveEntityVertexConfig)
   })

   const lastEntityLoad = () => entityLoads[entityLoads.length - 1]

   it('opens the socket and loads the entity when a route id arrives', () => {
      graph.dispatch(liveEntityActions.routeEntityChanged('a'))

      expect(vertex.currentState.currentId).to.equal('a')
      expect(opened).to.deep.equal(['a'])
      expect(vertex.currentLoadableState.fields.entity.status).to.equal(
         'loading'
      )

      lastEntityLoad().next({ id: 'a', name: 'Alpha' })
      expect(vertex.currentState.entity).to.deep.equal({
         id: 'a',
         name: 'Alpha'
      })
   })

   it('routes socket events into the slice (incl. event-only `ended`)', () => {
      graph.dispatch(liveEntityActions.routeEntityChanged('a'))

      sockets['a'].next({ type: 'renamed', name: 'Renamed' })
      expect(vertex.currentState.liveName).to.equal('Renamed')

      sockets['a'].next({ type: 'ended' })
      expect(vertex.currentState.ended).to.be.true
   })

   it('re-keys the socket on navigation: close-before-open, one per id', () => {
      graph.dispatch(liveEntityActions.routeEntityChanged('a'))
      sockets['a'].next({ type: 'ended' }) // event-only state set

      graph.dispatch(liveEntityActions.routeEntityChanged('b'))

      // switchMap tore down 'a' before opening 'b' — exactly one socket per id.
      expect(closed).to.deep.equal(['a'])
      expect(opened).to.deep.equal(['a', 'b'])
      // The event-only `ended` was reset by NAVIGATION, not by any unmount.
      expect(vertex.currentState.ended).to.be.false
      expect(vertex.currentState.liveName).to.be.null
   })

   it('null on navigate-away clears the entity and closes the socket', () => {
      graph.dispatch(liveEntityActions.routeEntityChanged('a'))
      lastEntityLoad().next({ id: 'a', name: 'Alpha' })

      graph.dispatch(liveEntityActions.routeEntityChanged(null))

      expect(closed).to.deep.equal(['a'])
      expect(vertex.currentState.currentId).to.be.null
      expect(vertex.currentState.entity).to.be.null
   })
})
