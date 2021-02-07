// externals
import { Config, isListType, isObjectType, getRootType, selectionTypeInfo } from 'houdini-common'
import * as graphql from 'graphql'
import mkdirp from 'mkdirp'
// locals
import { CollectedGraphQLDocument } from '../types'

// We consider every query and every mutation that could affect it. This can only possibly
// happen if we get the {id} of the type in the payload. Therefore we're going to look at
// every mutation and collect the types in the payload with {id} in their selection set.
// Then look at every query and fragment to see if it asks for the type. If so, then
// we need to generate some kind of response handler.

// keep track of which mutation affects which fields of which type
type MutationMap = {
	[typeName: string]: {
		[fieldName: string]: {
			// keep track of the path in the response that points to the updated object
			[mutationName: string]: string[]
		}
	}
}

type Interaction = {
	mutationName: string
	mutationPath: string[]
	queryName: string
	queryPath: string[]
}

type InteractionMap = { [mutationName: string]: [] }

export default async function mutationGenerator(config: Config, docs: CollectedGraphQLDocument[]) {
	// make sure the mutation directory exists
	await mkdirp(config.mutationHandlersDirectory)

	// build up a map of mutations to the types they modify
	const mutationTargets: MutationMap = {}

	// look at every document for one containing a mutation
	for (const { name, document } of docs) {
		// look for a mutation definition in the document
		const definition = document.definitions.find(
			(definition) =>
				definition.kind === graphql.Kind.OPERATION_DEFINITION &&
				definition.operation === 'mutation'
		) as graphql.OperationDefinitionNode

		// if there isn't one, we dont care about this document
		if (!definition) {
			continue
		}

		// the first level of selections are the mutations triggered by the document
		// we can push it through the recursion like normal. we'll only run into problems
		// if one of the mutations is named or aliased 'id'
		if (
			definition.selectionSet.selections.find(
				(selection) =>
					selection.kind === graphql.Kind.FIELD &&
					(selection.alias?.value || selection.name.value) === 'id'
			)
		) {
			throw new Error('Encountered mutation named id.')
		}

		const mutationType = config.schema.getMutationType()
		if (!mutationType) {
			throw new Error('Schema does not have a mutation type defined.')
		}

		// collect all of the fields referenced by the mutation
		// and fragments within the mutation since those are the fields that we
		// will update in response to the mutation
		collectFields(config, mutationTargets, name, mutationType, definition.selectionSet, [])
	}

	// now that we know which fields the mutation can update we can walk through every document
	// and look for queries or fragments that intersect with the fields changed by the mutations
	const interactions: Interaction[] = []

	// we will run into the same document many times so we have to make sure we are only processing a document once
	const _interactionDocumentsVisited: { [name: string]: boolean } = {}

	// every document with a query might have an interaction with a mutation, the compiler identifier
	// doesn't matter because multiple documents could include the same fragment.
	for (const definition of docs.flatMap(({ document }) => document.definitions)) {
		// we only care about fragments or query definitions
		if (
			definition.kind !== graphql.Kind.FRAGMENT_DEFINITION &&
			(definition.kind !== graphql.Kind.OPERATION_DEFINITION ||
				definition.operation !== 'query')
		) {
			continue
		}
		// if there's no name (shouldn't make it this far but lets keep typescript happy)
		if (!definition.name) {
			throw new Error('Encountered document with no name')
		}

		// if we have seen this document already, ignore it
		if (_interactionDocumentsVisited[definition.name.value]) {
			continue
		}

		// find the root type
		const rootType =
			definition.kind === graphql.Kind.OPERATION_DEFINITION
				? config.schema.getQueryType()
				: (config.schema.getType(
						definition.typeCondition.name.value
				  ) as graphql.GraphQLObjectType<any, any>)

		// make sure we found something
		if (!rootType) {
			throw new Error('could not find root type for document: ' + name)
		}

		// compute and add the interactions
		addInteractions(
			config,
			interactions,
			mutationTargets,
			definition.name.value,
			rootType,
			definition.selectionSet
		)

		// we're done with this document
		_interactionDocumentsVisited[definition.name.value] = true
	}

	// we now have a list of every possible interaction
}

function addInteractions(
	config: Config,
	interactions: Interaction[],
	mutationTargets: MutationMap,
	name: string,
	rootType: graphql.GraphQLObjectType<any, any>,
	{ selections }: graphql.SelectionSetNode,
	path: string[] = []
) {
	// every selection in the selection set might contribute an interaction
	for (const selection of selections) {
		// ignore any fragment spreads
		if (selection.kind === graphql.Kind.FRAGMENT_SPREAD) {
			continue
		}

		// inline fragments
		if (selection.kind === graphql.Kind.INLINE_FRAGMENT) {
			continue
		}

		// get the type info for the selection
		const { type } = selectionTypeInfo(config.schema, rootType, selection)

		// if we are looking at a normal field
		if (selection.kind === graphql.Kind.FIELD) {
			const attributeName = selection.alias?.value || selection.name.value
			const pathSoFar = path.concat(attributeName)

			// if the field is a scalar, it could be updated by a mutation (needs an entry in interactions)
			if (graphql.isLeafType(type)) {
				// grab the object mapping mutation names to the path in response that updates this field
				let mutators
				// look up the field in mutation map
				try {
					mutators = mutationTargets[rootType.name][attributeName]
				} catch (e) {
					continue
				}

				for (const mutationName of Object.keys(mutators)) {
					// we have an interaction
					interactions.push({
						mutationName,
						mutationPath: mutators[mutationName],
						queryName: name,
						queryPath: pathSoFar,
					})
				}

				// we're done processing the leaf node
				continue
			}

			// if the field is points to another type (is an object or list)
			if (selection.selectionSet && (isListType(type) || isObjectType(type))) {
				// walk down the query for more chagnes
				addInteractions(
					config,
					interactions,
					mutationTargets,
					name,
					getRootType(type) as graphql.GraphQLObjectType<any, any>,
					selection.selectionSet,
					pathSoFar
				)
			}
		}
	}
}

function collectFields(
	config: Config,
	mutationTargets: MutationMap,
	name: string,
	rootType: graphql.GraphQLObjectType<any, any>,
	selectionSet: graphql.SelectionSetNode,
	path: string[]
) {
	// only consider fields in this selection if we have the id present
	const useFields = selectionSet.selections.length > 1

	// every field in the selection set could contribute to the mutation's targets
	for (const selection of selectionSet.selections) {
		// look up the type of the selection
		const { type, field } = selectionTypeInfo(config.schema, rootType, selection)

		// ignore any fragment spreads
		if (selection.kind === graphql.Kind.FRAGMENT_SPREAD) {
			continue
		}

		// process inline fragments
		if (selection.kind === graphql.Kind.INLINE_FRAGMENT) {
			continue
		}

		// if we are looking at a normal field
		if (selection.kind === graphql.Kind.FIELD) {
			const attributeName = selection.alias?.value || selection.name.value
			const pathSoFar = path.concat(attributeName)

			// if the field is a scalar type and there is an id field
			if (graphql.isLeafType(type) && useFields) {
				// make sure the object's deep index exists
				if (!mutationTargets[rootType.name]) {
					mutationTargets[rootType.name] = {}
				}
				if (!mutationTargets[rootType.name][attributeName]) {
					mutationTargets[rootType.name][attributeName] = {}
				}

				// add the field to the list of things that the mutation can update
				mutationTargets[rootType.name][attributeName][name] = pathSoFar

				// we're done
				continue
			}

			// if the field is points to another type (is an object or list)
			if (selection.selectionSet && (isListType(type) || isObjectType(type))) {
				// walk down the query for more chagnes
				collectFields(
					config,
					mutationTargets,
					name,
					getRootType(type) as graphql.GraphQLObjectType<any, any>,
					selection.selectionSet,
					pathSoFar
				)
			}
		}
	}
}