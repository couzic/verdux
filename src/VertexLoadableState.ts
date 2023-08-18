import { VertexLoadedState, VertexState } from './VertexState';
import { VertexType } from './VertexType';

export type VertexLoadableState<Type extends VertexType> =
   | {
      status: 'loading',
      errors: [],
      state: VertexState<Type>,
      loadableFields: { [K in keyof Type['loadableFields']]:
         | { status: 'loading'; value: undefined; error: undefined }
         | {
            status: 'loaded'
            value: Type['loadableFields'][K]
            error: undefined
         } }
   }
   | {
      status: 'error'
      errors: Error[],
      state: VertexState<Type>,
      loadableFields: {
         [K in keyof Type['loadableFields']]:
         | { status: 'loading'; value: undefined; error: undefined }
         | { status: 'error'; value: undefined; error: Error }
         | {
            status: 'loaded'
            value: Type['loadableFields'][K]
            error: undefined
         }
      }
   }
   | {
      status: 'loaded',
      errors: [],
      state: VertexLoadedState<Type>,
      loadableFields: { [K in keyof Type['loadableFields']]: {
         status: 'loaded'
         value: Type['loadableFields'][K]
         error: undefined
      } }
   }



// export type StoreData<Type extends StoreType> =
//   | LoadingData<Type>
//   | LoadedData<Type>

// export type LoadingData<Type extends StoreType> = {
//   [K in StoreDataKey<Type>]: K extends keyof Type['loadableValues']
//   ? Type['loadableValues'][K] | undefined
//   : K extends keyof Type['values']
//   ? Type['values'][K]
//   : K extends keyof Type['reduxState']
//   ? Type['reduxState'][K]
//   : never
// }

// export type LoadedData<Type extends StoreType> = {
//   [K in StoreDataKey<Type>]: K extends keyof Type['loadableValues']
//   ? Type['loadableValues'][K]
//   : K extends keyof Type['values']
//   ? Type['values'][K]
//   : K extends keyof Type['reduxState']
//   ? Type['reduxState'][K]
//   : never
// }

// export type PickedLoadedState<
//   Type extends StoreType,
//   K extends StoreDataKey<Type>
// > = LoadedState<{
//   reduxState: {
//     [K in Exclude<
//       keyof Type['reduxState'],
//       keyof Type['values'] | keyof Type['loadableValues']
//     >]: Type['reduxState'][K]
//   }
//   values: Pick<Type['values'], Exclude<K, keyof Type['loadableValues']>>
//   loadableValues: Pick<Type['loadableValues'], K>
//   actions: Type['actions']
//   dependencies: Type['dependencies']
// }>
