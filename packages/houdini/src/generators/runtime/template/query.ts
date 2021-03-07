// externals
import { readable, Readable } from 'svelte/store'
import { onMount } from 'svelte'
// locals
import { Operation, GraphQLTagResult } from './types'
import cache from './cache'
import { setVariables } from './context'

export default function query<_Query extends Operation<any, any>>(
	document: GraphQLTagResult
): Readable<_Query['result']> {
	// make sure we got a query document
	if (document.kind !== 'HoudiniQuery') {
		throw new Error('getQuery can only take query operations')
	}

	// emebed the variables in the components context
	setVariables(document.variables)

	// wrap the result in a store we can use to keep this query up to date
	const value = readable(document.initialValue.data, (set) => {
		const { artifact } = document

		// when the component mounts
		onMount(() => {
			// once we've mounted
			cache.write(artifact.selection, document.initialValue.data, document.variables)

			// stay up to date
			cache.subscribe({
				rootType: artifact.rootType,
				selection: artifact.selection,
				set,
			})
		})

		// the function used to clean up the store
		return () => {
			cache.unsubscribe({
				rootType: artifact.rootType,
				selection: artifact.selection,
				set,
			})
		}
	})

	return value
}
