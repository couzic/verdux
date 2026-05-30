import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { Observable, of } from 'rxjs'
import { configureRootVertex, configureVertex } from 'verdux'

// MULTIPLE-UPSTREAMS EXCEPTION to the tree-first rule.
//
// The default way to build a vertex is `parent.configureDownstreamVertex(...)`,
// chained off its single parent. Reach for `configureVertex(options, builder =>
// builder.addUpstreamVertex(...))` ONLY when a vertex must read fields or
// dependencies from MORE THAN ONE upstream vertex — a true multi-parent DAG
// node. This file is that exception: `dashboard` derives from two siblings.
//
//   root  (owns kpiService dependency)
//    ├── user     (owns `userId`)
//    ├── filters  (owns `dateRange`)
//    └── dashboard  ← reads userId + dateRange from BOTH siblings

// -------- root: the dependency well -----------------------------------------

interface KpiService {
   fetch: (userId: string, dateRange: string) => Observable<number>
}

const rootVertexConfig = configureRootVertex({
   slice: createSlice({ name: 'root', initialState: {}, reducers: {} }),
   dependencies: {
      kpiService: (): KpiService => ({
         fetch: (_userId, _dateRange) => of(42)
      })
   }
})

// -------- two sibling vertices, each single-parent off root ------------------

const userSlice = createSlice({
   name: 'user',
   initialState: { userId: 'u1' },
   reducers: {
      userChanged: (state, action: PayloadAction<string>) => {
         state.userId = action.payload
      }
   }
})
export const userActions = userSlice.actions
export const userVertexConfig = rootVertexConfig.configureDownstreamVertex({
   slice: userSlice
})

const filtersSlice = createSlice({
   name: 'filters',
   initialState: { dateRange: '7d' },
   reducers: {
      dateRangeChanged: (state, action: PayloadAction<string>) => {
         state.dateRange = action.payload
      }
   }
})
export const filtersActions = filtersSlice.actions
export const filtersVertexConfig = rootVertexConfig.configureDownstreamVertex({
   slice: filtersSlice
})

// -------- the multi-parent vertex -------------------------------------------

const dashboardSlice = createSlice({
   name: 'dashboard',
   initialState: {},
   reducers: {}
})

export const dashboardVertexConfig = configureVertex(
   { slice: dashboardSlice },
   builder =>
      builder
         // Pull the `userId` field from `user`, AND pull the `kpiService`
         // dependency that flowed down to `user` from the root. A root
         // dependency does NOT auto-flow to a multi-parent vertex — it must be
         // pulled here (or the whole upstream's deps inherited by omitting the
         // `dependencies` option). See verdux-graph-design "multiple upstreams".
         .addUpstreamVertex(userVertexConfig, {
            fields: ['userId'],
            dependencies: ['kpiService']
         })
         // Pull only the `dateRange` field from `filters`.
         .addUpstreamVertex(filtersVertexConfig, {
            fields: ['dateRange']
         })
).withDependencies(({ kpiService }, vertex) =>
   vertex
      .loadFromFields(['userId', 'dateRange'], {
         kpi: ({ userId, dateRange }) => kpiService.fetch(userId, dateRange)
      })
      .computeFromFields(['userId', 'dateRange'], {
         label: ({ userId, dateRange }) => `${userId} / ${dateRange}`
      })
)

// Helper used by the test to build a self-contained graph.
export const multiUpstreamVertices = [
   userVertexConfig,
   filtersVertexConfig,
   dashboardVertexConfig
]
