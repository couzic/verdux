import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { concat, map, Observable, switchMap, timer as rxTimer } from 'rxjs'
import { configureRootVertex } from 'verdux'

// ---------------------------------------------------------------------------
// Self-clearing transients — the canonical "beats useEffect + setTimeout" case.
//
// A transient (toast, popup, flash) shows, waits, then clears itself. Instead
// of a fragile `useEffect`/`setTimeout` with hand-rolled dependency keys, model
// it as a `reaction$` whose `switchMap` runs an injected timer: showing the
// transient again RESETS the timer for free (switchMap cancels the in-flight
// one), and the timing is testable because the timer is a dependency.
//
// Two tiers are shown in full here:
//   T1 — single-phase: `flash` clears after FLASH_MS; a new flash resets it.
//   T2 — two-phase: `bonus` goes shown → (2s) exiting → (0.5s) cleared, the
//        whole sequence expressed as `concat(timer, timer)` inside one switchMap
//        so a re-show cancels a mid-flight sequence.
// (For N independent instances keyed by id, see the groupBy/mergeMap pointer in
//  the operations skill — that's generic rxjs fan-out, no new verdux idea.)
// ---------------------------------------------------------------------------

// The injected timer. `timer(ms)` is an Observable SOURCE (the thing you
// switchMap TO), unlike `time.debounce(ms)` which is an operator you pipe
// THROUGH — both live under the one injectable `time` dependency. In tests a
// ManualClock stands in for it (see selfClearingTransient.test.ts).
export interface Time {
   timer: (ms: number) => Observable<number>
}

const FLASH_MS = 3000
const BONUS_SHOW_MS = 2000
const BONUS_EXIT_MS = 500

interface BonusState {
   id: string
   phase: 'shown' | 'exiting'
}
interface TransientState {
   flash: string | null
   bonus: BonusState | null
}

const slice = createSlice({
   name: 'transients',
   initialState: { flash: null, bonus: null } as TransientState,
   reducers: {
      resultFlashed: (state, action: PayloadAction<string>) => {
         state.flash = action.payload
      },
      flashCleared: state => {
         state.flash = null
      },
      bonusShown: (state, action: PayloadAction<{ id: string }>) => {
         state.bonus = { id: action.payload.id, phase: 'shown' }
      },
      // The id check guards CROSS-id staleness (a clear/exit for an id that a
      // newer bonus already replaced), not the same-id re-show race — switchMap
      // cancels that synchronously, so no guard is needed for it (proven by the
      // "re-showing mid-sequence" test, where a same-id guard couldn't help).
      bonusExiting: (state, action: PayloadAction<string>) => {
         if (state.bonus && state.bonus.id === action.payload)
            state.bonus.phase = 'exiting'
      },
      bonusCleared: (state, action: PayloadAction<string>) => {
         if (state.bonus && state.bonus.id === action.payload) state.bonus = null
      }
   }
})

export const transientActions = slice.actions
const { resultFlashed, flashCleared, bonusShown, bonusExiting, bonusCleared } =
   slice.actions

// An empty root with NO dependencies — the pure dependency-sink convention.
const rootVertexConfig = configureRootVertex({
   slice: createSlice({ name: 'root', initialState: {}, reducers: {} })
})

export const transientVertexConfig = rootVertexConfig
   // `time` is consumed only here, so it is scoped to this vertex rather than
   // hoisted to the root well.
   .configureDownstreamVertex({
      slice,
      dependencies: { time: (): Time => ({ timer: ms => rxTimer(ms) }) }
   })
   .withDependencies(({ time }, vertex) =>
      vertex
         // T1: show → (FLASH_MS) → clear. A new resultFlashed cancels the
         // pending clear via switchMap and starts the timer over.
         .reaction$(resultFlashed, in$ =>
            in$.pipe(
               switchMap(() =>
                  time.timer(FLASH_MS).pipe(map(() => flashCleared()))
               )
            )
         )
         // T2: show → (BONUS_SHOW_MS) → exiting → (BONUS_EXIT_MS) → cleared.
         // The two phases are one `concat` inside one switchMap, so re-showing
         // mid-sequence cancels whatever phase was pending and restarts.
         .reaction$(bonusShown, in$ =>
            in$.pipe(
               switchMap(({ payload }) =>
                  concat(
                     time
                        .timer(BONUS_SHOW_MS)
                        .pipe(map(() => bonusExiting(payload.id))),
                     time
                        .timer(BONUS_EXIT_MS)
                        .pipe(map(() => bonusCleared(payload.id)))
                  )
               )
            )
         )
   )
