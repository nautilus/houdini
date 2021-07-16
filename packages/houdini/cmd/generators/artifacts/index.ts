// externals
import { Config, getRootType, hashDocument, parentTypeFromAncestors } from 'houdini-common'
import * as graphql from 'graphql'
import {
	CompiledQueryKind,
	CompiledFragmentKind,
	CompiledMutationKind,
	CompiledDocumentKind,
	CompiledSubscriptionKind,
	CollectedGraphQLDocument,
} from '../../types'
import * as recast from 'recast'
// locals
import { moduleExport, writeFile } from '../../utils'
import selection from './selection'
import { operationsByPath, FilterMap } from './operations'
import writeIndexFile from './indexFile'
import { inputObject } from './inputs'

const AST = recast.types.builders

// the artifact generator creates files in the runtime directory for each
// document containing meta data that the preprocessor might use
export default async function artifactGenerator(config: Config, docs: CollectedGraphQLDocument[]) {
	// put together the type information for the filter for everylist
	const filterTypes: FilterMap = {}

	for (const doc of docs) {
		graphql.visit(doc.document, {
			// look for any field marked with alist
			Directive(node, _, __, ___, ancestors) {
				// we only care about lists
				if (node.name.value !== config.listDirective) {
					return
				}

				// get the name of thelist
				const nameArg = node.arguments?.find((arg) => arg.name.value === config.listNameArg)
				if (!nameArg || nameArg.value.kind !== 'StringValue') {
					throw new Error('could not find name arg in list directive')
				}
				const listName = nameArg.value.value

				// look up the actual field in the ancestor list so we can get type info
				let field = ancestors[ancestors.length - 1] as graphql.FieldNode
				let i = 1
				while (Array.isArray(field)) {
					i++
					field = ancestors[ancestors.length - i] as graphql.FieldNode
				}
				if (field.kind !== 'Field') {
					return
				}

				// look up the parent's type so we can ask about the field marked as alist
				const parentType = parentTypeFromAncestors(config.schema, [
					...ancestors.slice(0, -1),
				]) as graphql.GraphQLObjectType
				const parentField = parentType.getFields()[field.name.value]
				if (!parentField) {
					throw new Error('Could not find field information when computing filters')
				}
				const fieldType = getRootType(parentField.type).toString()

				// look at every arg on the list to figure out the valid filters
				filterTypes[listName] = parentField.args.reduce((prev, arg) => {
					return {
						...prev,
						[arg.name]: getRootType(arg.type).toString(),
					}
				}, {})

				// the delete directive is an interesting one since there isn't a specific
				// list. we need to use something that points to deleting an instance of
				// the type as a key
				filterTypes[`${fieldType}_delete`] = {
					...filterTypes[`${fieldType}_delete`],
					// every field with the list type adds to the delete filters
					...filterTypes[listName],
				}
			},
		})
	}

	// we have everything we need to generate the artifacts
	await Promise.all(
		[
			// generate the index file
			writeIndexFile(config, docs),
		].concat(
			// and an artifact for every document
			docs.map(async ({ document, name, generated }) => {
				// if the document is generated, don't write it to disk - it's use is to provide definitions
				// for the other transforms
				if (generated) {
					return
				}

				// before we can print the document, we need to strip all references to internal directives
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

				// figure out the document kind
				let docKind: CompiledDocumentKind | null = null

				// look for the operation
				const operations = document.definitions.filter(
					({ kind }) => kind === graphql.Kind.OPERATION_DEFINITION
				) as graphql.OperationDefinitionNode[]
				// there are no operations, so its a fragment
				const fragments = document.definitions.filter(
					({ kind }) => kind === graphql.Kind.FRAGMENT_DEFINITION
				) as graphql.FragmentDefinitionNode[]

				// if there are operations in the document
				if (operations.length > 0 && operations[0].kind === 'OperationDefinition') {
					const { operation } = operations[0]

					// figure out if its a query
					if (operation === 'query') {
						docKind = CompiledQueryKind
					}
					// or a mutation
					else if (operation === 'mutation') {
						docKind = CompiledMutationKind
					}
					// or a subscription
					else if (operation === 'subscription') {
						docKind = CompiledSubscriptionKind
					}
				}
				// if there are operations in the document
				else if (fragments.length > 0) {
					docKind = CompiledFragmentKind
				}

				// if we couldn't figure out the kind
				if (!docKind) {
					throw new Error('Could not figure out what kind of document we were given')
				}

				// generate a hash of the document that we can use to detect changes
				// start building up the artifact
				const artifact = AST.objectExpression([
					AST.objectProperty(AST.identifier('name'), AST.stringLiteral(name)),
					AST.objectProperty(AST.identifier('kind'), AST.stringLiteral(docKind)),
					AST.objectProperty(
						AST.identifier('hash'),
						AST.stringLiteral(hashDocument(rawString))
					),
					AST.objectProperty(
						AST.identifier('raw'),
						AST.templateLiteral(
							[AST.templateElement({ raw: rawString, cooked: rawString }, true)],
							[]
						)
					),
				])

				let rootType: string | undefined = ''
				let selectionSet: graphql.SelectionSetNode

				// if we are generating the artifact for an operation
				if (docKind !== 'HoudiniFragment') {
					// find the operation
					const operation = operations[0]

					if (operation.operation === 'query') {
						rootType = config.schema.getQueryType()?.name
					} else if (operation.operation === 'mutation') {
						rootType = config.schema.getMutationType()?.name
					} else if (operation.operation === 'subscription') {
						rootType = config.schema.getSubscriptionType()?.name
					}
					if (!rootType) {
						throw new Error(
							'could not find root type for operation: ' +
								operation.operation +
								'. Maybe you need to re-run the introspection query?'
						)
					}

					// use this selection set
					selectionSet = operation.selectionSet
				}
				// we are looking at a fragment so use its selection set and type for the subscribe index
				else {
					// there are a lot of fragments added to a document. The fragment we care about
					// is the one with the matching name
					const matchingFragment = fragments.find(
						(fragment) => fragment.name.value === name
					)
					if (!matchingFragment) {
						throw new Error("Fragment doesn't exist in its own document?!")
					}
					rootType = matchingFragment.typeCondition.name.value
					selectionSet = matchingFragment.selectionSet
				}

				// add the selection information so we can subscribe to the store
				artifact.properties.push(
					AST.objectProperty(AST.identifier('rootType'), AST.stringLiteral(rootType)),
					AST.objectProperty(
						AST.identifier('selection'),
						selection({
							config,
							rootType,
							selectionSet: selectionSet,
							operations: operationsByPath(config, operations[0], filterTypes),
							// do not include used fragments if we are rendering the selection
							// for a fragment document
							includeFragments: docKind !== 'HoudiniFragment',
							document,
						})
					)
				)

				// if there are inputs to the operation
				const inputs = operations[0]?.variableDefinitions
				// add the input type definition to the artifact
				if (inputs && inputs.length > 0) {
					artifact.properties.push(
						AST.objectProperty(AST.identifier('input'), inputObject(config, inputs))
					)
				}

				// the artifact should be the default export of the file
				const file = AST.program([moduleExport(config, 'default', artifact)])

				// write the result to the artifact path we're configured to write to
				await writeFile(config.artifactPath(document), recast.print(file).code)
				// log the file location to confirm
				if (!config.quiet) {
					console.log(name)
				}
			})
		)
	)
}
