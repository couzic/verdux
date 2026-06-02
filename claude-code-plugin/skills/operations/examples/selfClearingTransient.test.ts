import { expect } from 'chai'
import { Observable, Subject } from 'rxjs'
import { createGraph, Graph, Vertex } from 'verdux'
import {
   Time,
   transientActions,
   transientVertexConfig
} from './selfClearingTransient'

// ---------------------------------------------------------------------------
// ManualClock — the whole reason these transients are testable without fake
// timers. `timer(ms)` returns a COLD Observable (like rxjs `timer`): it only
// registers when subscribed and drops itself on teardown. `fire(ms)` makes
// every currently-subscribed timer at that delay emit. The trick that makes it
// correct is verdux's SYNCHRONOUS guarantee: when a new trigger arrives,
// switchMap unsubscribes the previous timer synchronously, so it is gone before
// any later `fire(ms)` — no leak, no stale clear.
// ---------------------------------------------------------------------------
class ManualClock {
   private pending: { ms: number; subject: Subject<number> }[] = []

   timer = (ms: number): Observable<number> =>
      new Observable<number>(subscriber => {
         const entry = { ms, subject: new Subject<number>() }
         this.pending.push(entry)
         const inner = entry.subject.subscribe(subscriber)
         return () => {
            inner.unsubscribe()
            const i = this.pending.indexOf(entry)
            if (i >= 0) this.pending.splice(i, 1)
         }
      })

   // Fire every timer currently subscribed for exactly this delay.
   fire(ms: number) {
      const due = this.pending.filter(p => p.ms === ms)
      this.pending = this.pending.filter(p => p.ms !== ms)
      due.forEach(({ subject }) => {
         subject.next(0)
         subject.complete()
      })
   }
}

describe('self-clearing transients (injected timer, no fake timers)', () => {
   let graph: Graph
   let vertex: Vertex<typeof transientVertexConfig>
   let clock: ManualClock

   beforeEach(() => {
      clock = new ManualClock()
      const time: Time = { timer: clock.timer }
      graph = createGraph({
         // injectedWith overrides `time` directly on the vertex that declares it
         vertices: [transientVertexConfig.injectedWith({ time })]
      })
      vertex = graph.getVertexInstance(transientVertexConfig)
   })

   it('T1: a flash clears itself after the timer fires', () => {
      graph.dispatch(transientActions.resultFlashed('Added to cart'))
      expect(vertex.currentState.flash).to.equal('Added to cart')

      clock.fire(3000)
      expect(vertex.currentState.flash).to.be.null
   })

   it('T1: a new flash resets the timer (switchMap cancels the old clear)', () => {
      graph.dispatch(transientActions.resultFlashed('A'))
      graph.dispatch(transientActions.resultFlashed('B')) // resets the 3s timer
      expect(vertex.currentState.flash).to.equal('B')

      // switchMap unsubscribed the 'A' timer (the ManualClock drops it on
      // teardown), so only the live 'B' timer remains to clear.
      clock.fire(3000)
      expect(vertex.currentState.flash).to.be.null
   })

   it('T2: the bonus runs its two-phase lifecycle', () => {
      graph.dispatch(transientActions.bonusShown({ id: 'x' }))
      expect(vertex.currentState.bonus).to.deep.equal({ id: 'x', phase: 'shown' })

      clock.fire(2000)
      expect(vertex.currentState.bonus).to.deep.equal({
         id: 'x',
         phase: 'exiting'
      })

      clock.fire(500)
      expect(vertex.currentState.bonus).to.be.null
   })

   it('T2: re-showing mid-sequence cancels the in-flight clear', () => {
      graph.dispatch(transientActions.bonusShown({ id: 'x' }))
      clock.fire(2000) // now in the 'exiting' phase, clear pending at 500ms

      // Re-show the SAME id before the clear fires. switchMap cancels the
      // pending concat, so the stale clear must never land — and a reducer
      // guard can't save us here (same id), so this proves the cancellation.
      graph.dispatch(transientActions.bonusShown({ id: 'x' }))
      expect(vertex.currentState.bonus).to.deep.equal({ id: 'x', phase: 'shown' })

      clock.fire(500) // the cancelled clear timer — must be a no-op
      expect(vertex.currentState.bonus).to.deep.equal({ id: 'x', phase: 'shown' })

      // The fresh sequence still completes normally.
      clock.fire(2000)
      expect(vertex.currentState.bonus).to.deep.equal({
         id: 'x',
         phase: 'exiting'
      })
      clock.fire(500)
      expect(vertex.currentState.bonus).to.be.null
   })
})
