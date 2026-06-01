import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { catchError, map, Observable, of, switchMap } from 'rxjs'
import { configureRootVertex } from 'verdux'

// Worked example for the "state boundary" rule: a profile-edit form whose
// ENTIRE state — the editable field values, their validation, the `editing`
// flag, and the save lifecycle (`saving` / `error`) — lives in the vertex. The
// React component (sketched in the skill prose) is a presentational shell: it
// reads these fields and dispatches these actions, with zero useState and zero
// useEffect. Splitting the field values into useState and `editing` into the
// slice would fragment one form across two systems; keep all of it here.

interface Profile {
   displayName: string
   bio: string
   interests: string[]
}

interface ProfileFormState {
   editing: boolean
   displayName: string
   bio: string
   interests: string[]
   saving: boolean
   error: string | null
}

const initialState: ProfileFormState = {
   editing: false,
   displayName: '',
   bio: '',
   interests: [],
   saving: false,
   error: null
}

const slice = createSlice({
   name: 'profileForm',
   initialState,
   reducers: {
      // Seed the fields from the current profile and enter edit mode.
      editingStarted: (state, { payload }: PayloadAction<Profile>) => {
         state.editing = true
         state.error = null
         state.displayName = payload.displayName
         state.bio = payload.bio
         state.interests = payload.interests
      },
      // Validation / transformation lives in the reducer, NOT the component:
      // trim + length-cap here, toggle membership below.
      displayNameChanged: (state, { payload }: PayloadAction<string>) => {
         state.displayName = payload.trimStart().slice(0, 50)
      },
      bioChanged: (state, { payload }: PayloadAction<string>) => {
         state.bio = payload.slice(0, 280)
      },
      interestToggled: (state, { payload }: PayloadAction<string>) => {
         state.interests = state.interests.includes(payload)
            ? state.interests.filter(i => i !== payload)
            : [...state.interests, payload]
      },
      editingCancelled: state => {
         state.editing = false
         state.error = null
      },
      // onSubmit dispatches this — never a local setState.
      submitRequested: state => {
         state.saving = true
         state.error = null
      },
      // The save lifecycle IS slice state. No useEffect syncs it to React;
      // saveSucceeded flips `editing` off where the component just reads it.
      saveSucceeded: state => {
         state.saving = false
         state.editing = false
      },
      saveFailed: (state, { payload }: PayloadAction<string>) => {
         state.saving = false
         state.error = payload
      }
   }
})

export const profileFormActions = slice.actions
const { submitRequested, saveSucceeded, saveFailed } = slice.actions

interface ApiClient {
   updateProfile: (profile: Profile) => Observable<void>
}

// Self-contained root so this example compiles on its own.
const formRootVertexConfig = configureRootVertex({
   slice: createSlice({ name: 'root', initialState: {}, reducers: {} }),
   dependencies: {
      apiClient: (): ApiClient => ({ updateProfile: () => of(undefined) })
   }
})

export const profileFormVertexConfig = formRootVertexConfig
   .configureDownstreamVertex({ slice })
   .withDependencies(({ apiClient }, vertex) =>
      // The save flow is an action→action reaction. submitRequested comes from
      // the component's onSubmit; the outcome is saveSucceeded / saveFailed,
      // which flip `editing` and `saving` in the slice. The component never
      // observes that transition imperatively — it just re-reads the fields.
      vertex.reaction$(submitRequested, input$ =>
         input$.pipe(
            switchMap(({ state }) =>
               apiClient
                  .updateProfile({
                     displayName: state.displayName,
                     bio: state.bio,
                     interests: state.interests
                  })
                  .pipe(
                     map(() => saveSucceeded()),
                     catchError(err =>
                        of(saveFailed(err instanceof Error ? err.message : String(err)))
                     )
                  )
            )
         )
      )
   )
