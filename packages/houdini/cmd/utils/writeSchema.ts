import * as graphql from 'graphql'
import fs from 'fs/promises'
import fetch from 'node-fetch'

export async function writeSchema(url: string, schemaPath: string) {
	// send the request
	const resp = await fetch(url, {
		method: 'POST',
		body: JSON.stringify({
			query: graphql.getIntrospectionQuery(),
		}),
		headers: { 'Content-Type': 'application/json' },
	})
	const content = await resp.text()
	try {
		const jsonSchema = JSON.parse(content).data
		const schema = graphql.buildClientSchema(jsonSchema);

		// Check if the schemapath ends with .gql or .graphql - if so write the schema as string
		// Otherwise write the json/introspection
		if (schemaPath!.endsWith('gql') || schemaPath!.endsWith('graphql')) {
			const schemaAsString = graphql.printSchema(graphql.lexicographicSortSchema(schema));
			await fs.writeFile(schemaPath, schemaAsString, 'utf-8')
		} else {
			await fs.writeFile(schemaPath, JSON.stringify(jsonSchema), 'utf-8')
		}
		// return the schema for usage in --pull-schema
		return schema
	} catch (e) {
		console.log('encountered error parsing response as json: ' + e.message)
		console.log('full body: ' + content)
		process.exit(0)
	}
}
