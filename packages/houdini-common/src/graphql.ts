import * as graphql from 'graphql'
import crypto from 'crypto'

// look up the selection type info
export function selectionTypeInfo(
	schema: graphql.GraphQLSchema,
	rootType: graphql.GraphQLObjectType<any, any>,
	selection: graphql.SelectionNode
): { field: graphql.GraphQLField<any, any>; type: graphql.GraphQLNamedType } {
	// the field we are looking at
	const selectionName = (selection as graphql.FieldNode).name.value
	const response = graphql.isNonNullType(rootType)
		? rootType.ofType.getFields()
		: rootType.getFields()

	const field = response[selectionName]

	if (!field) {
		throw new Error(
			`Could not find type information for field ${rootType.toString()}.${selectionName} ${field}`
		)
	}
	const fieldType = (graphql.getNamedType(field.type) as unknown) as graphql.GraphQLNamedType
	if (!fieldType) {
		throw new Error(
			`Could not find type information for field ${rootType.toString()}.${selectionName} ${field}`
		)
	}

	const fieldTypeName = fieldType.name

	// and the actual object type that it refers to
	// @ts-ignore
	const selectionType = schema.getType(fieldTypeName) as graphql.GraphQLObjectType
	if (!selectionType) {
		throw new Error('Could not find type for ' + fieldTypeName)
	}

	return { field, type: selectionType }
}

export function getRootType(type: graphql.GraphQLType): graphql.GraphQLType {
	// if the type is non-null, unwrap and go again
	if (graphql.isNonNullType(type)) {
		return getRootType((type as graphql.GraphQLNonNull<any>).ofType)
	}

	// if the type is non-null, unwrap and go again
	if (graphql.isListType(type)) {
		return getRootType((type as graphql.GraphQLList<any>).ofType)
	}

	// we've unwrapped everything
	return type
}

export function hashDocument(document: string | graphql.DocumentNode): string {
	// if we were given an AST document, print it first
	const docString = typeof document === 'string' ? document : graphql.print(document)

	// hash the string
	return crypto.createHash('sha256').update(docString).digest('hex')
}

type GraphQLParentType =
	| graphql.GraphQLObjectType
	| graphql.GraphQLInputObjectType
	| graphql.GraphQLInterfaceType

export function parentTypeFromAncestors(schema: graphql.GraphQLSchema, ancestors: readonly any[]) {
	const parents = [...ancestors] as (
		| graphql.OperationDefinitionNode
		| graphql.FragmentDefinitionNode
		| graphql.SelectionNode
	)[]
	parents.reverse()

	return walkAncestors(schema, parents)
}

function walkAncestors(
	schema: graphql.GraphQLSchema,
	ancestors: (
		| graphql.OperationDefinitionNode
		| graphql.FragmentDefinitionNode
		| graphql.SelectionNode
		| graphql.SelectionSetNode
	)[]
): GraphQLParentType {
	// get the front node
	let head = ancestors.shift()
	// if it was a list, skip it
	if (Array.isArray(head)) {
		return walkAncestors(schema, ancestors)
	}

	if (!head) {
		throw new Error('Could not figure out type of field')
	}

	// if we are at the top of the definition stack
	if (head.kind === 'OperationDefinition') {
		// grab the appropriate
		const operationType = {
			query: schema.getQueryType(),
			mutation: schema.getMutationType(),
			subscription: schema.getSubscriptionType(),
		}[head.operation]

		if (!operationType) {
			throw new Error('Could not find operation type')
		}
		return operationType
	}

	if (head.kind === 'FragmentDefinition') {
		// look up the type condition in the schema
		const result = schema.getType(head.typeCondition.name.value) as GraphQLParentType
		if (!result) {
			throw new Error(
				`Could not find definition for ${head.typeCondition.name.value} in the schema`
			)
		}

		// we're done here
		return result
	}

	// if we are looking at a fragment spread there is a serious problem
	if (head.kind === 'FragmentSpread') {
		throw new Error('How the hell did this happen?')
	}

	// grab our parent type
	const parent = walkAncestors(schema, ancestors)

	// if we are looking at an inline fragment
	if (head.kind === 'InlineFragment') {
		// if there is no type condition, then our parents type is the answer
		if (!head.typeCondition) {
			return parent
		}

		// look at the type condition to find the type
		const wrapper = schema.getType(head.typeCondition.name.value) as GraphQLParentType
		if (!wrapper) {
			throw new Error('Could not find type with name: ' + head.typeCondition.name.value)
		}

		return wrapper
	}

	// we are looking at a selection select our type is our parent's type
	if (head.kind === 'SelectionSet') {
		return parent
	}
	// we are looking at a field so we can just access the field map of the parent type
	const field = parent.getFields()[head.name.value]
	if (!field) {
		throw new Error(`Could not find definition of ${head.name.value} in ${parent.toString()}`)
	}

	return getRootType(field.type) as GraphQLParentType
}
