//externals
import { Config, hashDocument } from 'houdini-common'
import * as graphql from 'graphql'
import { writeFile } from 'fs/promises'
// internals
import { CollectedGraphQLDocument } from '../../types'

// the persist output generator is responsible for generating a queryMap.json
// to the provided path with the `hash` as key and the raw query as value.
export default async function persistOutputGenerator(
	config: Config,
	docs: CollectedGraphQLDocument[]
) {
	if (!config.outputPath || config.outputPath.length === 0) return

	if (!config.outputPath.endsWith('.json')) {
		console.log('Can only write the queryMap to a json file')
		return
	}

	const queryMap = docs.reduce<Record<string, string>>((acc, { document, generated }) => {
		// if the document is generated, just return early since there is no operation
		if (generated) {
			return acc
		}

		// Strip all references to internal directives
		let rawString = graphql.print(
			graphql.visit(document, {
				Directive(node) {
					// if the directive is one of the internal ones, remove it
					if (config.isInternalDirective(node)) {
						return null
					}
				},
			})
		)

		const operations = document.definitions.filter(
			({ kind }) => kind === graphql.Kind.OPERATION_DEFINITION
		) as graphql.OperationDefinitionNode[]

		// if there are operations in the document
		if (operations.length > 0 && operations[0].kind === 'OperationDefinition') {
			// Add it to the queryMap
			acc[hashDocument(rawString)] = rawString
		}

		return acc
	}, {})

	if (Object.keys(queryMap).length === 0) return

	// Write the queryMap to the provided path
	await writeFile(config.outputPath, JSON.stringify(queryMap), 'utf-8')
}
