import { ObservableResource, useObservableSuspense } from 'observable-hooks'
import { useContext, useMemo } from 'react'
import { VertexConfig, VertexFieldsDefinition, VertexInstance } from 'verdux'
import { GraphContext } from './GraphContext'

// Suspense-first React binding. The component suspends until every picked
// field is in a `loaded` status, then receives a flat object of the loaded
// values. Wrap consumer components in <Suspense fallback={...}>.
//
// Footgun: the useMemo dep array is intentionally empty, so the
// ObservableResource is constructed once per component instance. Changing
// `options.fields` between renders will NOT re-subscribe. For dynamic
// selections, remount the component with a `key`.

export const useVertexState = <
   Fields extends VertexFieldsDefinition,
   PickedFields extends keyof Fields
>(options: {
   vertex: VertexConfig<Fields>
   fields: PickedFields[]
}) => {
   const graph = useContext(GraphContext)
   if (!graph) throw new Error('GraphContext not found')

   const vertex = graph.getVertexInstance(
      options.vertex
   ) as VertexInstance<Fields, any>

   const resource = useMemo(
      () =>
         new ObservableResource(
            vertex.pick(options.fields),
            (_: any) => _.status === 'loaded'
         ),
      []
   )

   const loadableState = useObservableSuspense(resource)
   if (loadableState.status !== 'loaded') throw new Error('unreachable')
   return loadableState.state
}
