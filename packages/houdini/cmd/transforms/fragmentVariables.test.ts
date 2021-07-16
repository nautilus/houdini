// external imports
import { testConfig } from 'houdini-common'
import path from 'path'
import fs from 'fs/promises'
import * as typeScriptParser from 'recast/parsers/typescript'
import { ProgramKind } from 'ast-types/gen/kinds'
import * as recast from 'recast'
// local imports
import '../../../../jest.setup'
import { runPipeline } from '../generate'
import { mockCollectedDoc } from '../testUtils'

test('pass argument values to generated fragments', async function () {
	const docs = [
		mockCollectedDoc(
			`
                query AllUsers {
                    ...QueryFragment @with(name: "Hello")
                }
            `
		),
		mockCollectedDoc(
			`
                fragment QueryFragment on Query 
                @arguments(name: {type: "String"} ) {
                    users(stringValue: $name) { 
                        id
                    }
                }
            `
		),
	]

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	const queryContents = await fs.readFile(
		path.join(config.artifactPath(docs[0].document)),
		'utf-8'
	)
	expect(queryContents).toBeTruthy()
	// parse the contents
	const parsedQuery: ProgramKind = recast.parse(queryContents, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
        module.exports = {
            name: "AllUsers",
            kind: "HoudiniQuery",
            hash: "c346b9eaafaa74d18a267a74706e193e8080b9533d994d6e8489d7e5b534ee41",

            raw: \`query AllUsers {
          ...QueryFragment_10b3uv
        }

        fragment QueryFragment_10b3uv on Query {
          users(stringValue: "Hello") {
            id
          }
        }
        \`,

            rootType: "Query",

            selection: {
                "users": {
                    "type": "User",
                    "keyRaw": "users(stringValue: \\"Hello\\")",

                    "fields": {
                        "id": {
                            "type": "ID",
                            "keyRaw": "id"
                        }
                    }
                }
            }
        };
    `)
})

test("fragment arguments with default values don't rename the fragment", async function () {
	const docs = [
		mockCollectedDoc(
			`
                query AllUsers {
                    ...QueryFragment
                }
            `
		),
		mockCollectedDoc(
			`
                fragment QueryFragment on Query 
                @arguments(name: {type: "String", default: "Hello"}) {
                    users(stringValue: $name) { 
                        id
                    }
                }
            `
		),
	]

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	const queryContents = await fs.readFile(
		path.join(config.artifactPath(docs[0].document)),
		'utf-8'
	)
	expect(queryContents).toBeTruthy()
	// parse the contents
	const parsedQuery: ProgramKind = recast.parse(queryContents, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
        module.exports = {
            name: "AllUsers",
            kind: "HoudiniQuery",
            hash: "3835ee68277547d738cc8fd5051fe98799b5bd470516146906fa0f134a2b3891",

            raw: \`query AllUsers {
          ...QueryFragment
        }

        fragment QueryFragment on Query {
          users(stringValue: "Hello") {
            id
          }
        }
        \`,

            rootType: "Query",

            selection: {
                "users": {
                    "type": "User",
                    "keyRaw": "users(stringValue: \\"Hello\\")",

                    "fields": {
                        "id": {
                            "type": "ID",
                            "keyRaw": "id"
                        }
                    }
                }
            }
        };
    `)
})

test('thread query variables to inner fragments', async function () {
	const docs = [
		mockCollectedDoc(
			`
                query AllUsers($name: String!) {
                    ...QueryFragment @with(name: $name)
                }
            `
		),
		mockCollectedDoc(
			`
                fragment QueryFragment on Query 
                @arguments(name: {type: "String", default: "Hello"}) {
                    ...InnerFragment @with(name: $name)
                }
            `
		),
		mockCollectedDoc(
			`
                fragment InnerFragment on Query 
                @arguments(name: {type: "String", default: "Hello"}) {
                    users(stringValue: $name) { 
                        id
                    }
                }
            `
		),
	]

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	const queryContents = await fs.readFile(
		path.join(config.artifactPath(docs[0].document)),
		'utf-8'
	)
	expect(queryContents).toBeTruthy()
	// parse the contents
	const parsedQuery: ProgramKind = recast.parse(queryContents, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
        module.exports = {
            name: "AllUsers",
            kind: "HoudiniQuery",
            hash: "8fa4273ab75455c901e7de893f72a28af4c001afbf204ceca2fd7ab30b7ff372",

            raw: \`query AllUsers($name: String!) {
          ...QueryFragment_VDHGm
        }

        fragment QueryFragment_VDHGm on Query {
          ...InnerFragment_VDHGm
        }

        fragment InnerFragment_VDHGm on Query {
          users(stringValue: $name) {
            id
          }
        }
        \`,

            rootType: "Query",

            selection: {
                "users": {
                    "type": "User",
                    "keyRaw": "users(stringValue: $name)",

                    "fields": {
                        "id": {
                            "type": "ID",
                            "keyRaw": "id"
                        }
                    }
                }
            },

            input: {
                "fields": {
                    "name": "String"
                },

                "types": {}
            }
        };
    `)
})

test('inner fragment with intermediate default value', async function () {
	const docs = [
		mockCollectedDoc(
			`
                query AllUsers {
                    ...QueryFragment
                }
            `
		),
		mockCollectedDoc(
			`
                fragment QueryFragment on Query 
                @arguments(name: {type: "String", default: "Hello"}) {
                    ...InnerFragment @with(name: $name)
                }
            `
		),
		mockCollectedDoc(
			`
                fragment InnerFragment on Query 
                @arguments(name: {type: "String", default: "Goodbye"}, age: {type: "Int", default: 2}) {
                    users(stringValue: $name, intValue: $age) { 
                        id
                    }
                }
            `
		),
	]

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	const queryContents = await fs.readFile(
		path.join(config.artifactPath(docs[0].document)),
		'utf-8'
	)
	expect(queryContents).toBeTruthy()
	// parse the contents
	const parsedQuery: ProgramKind = recast.parse(queryContents, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
        module.exports = {
            name: "AllUsers",
            kind: "HoudiniQuery",
            hash: "d5753a3cae56b8133c72527cdccdd0c001effb48104b98806ac62dd9afeeb259",

            raw: \`query AllUsers {
          ...QueryFragment
        }

        fragment QueryFragment on Query {
          ...InnerFragment_10b3uv
        }

        fragment InnerFragment_10b3uv on Query {
          users(stringValue: "Hello", intValue: 2) {
            id
          }
        }
        \`,

            rootType: "Query",

            selection: {
                "users": {
                    "type": "User",
                    "keyRaw": "users(stringValue: \\"Hello\\", intValue: 2)",

                    "fields": {
                        "id": {
                            "type": "ID",
                            "keyRaw": "id"
                        }
                    }
                }
            }
        };
    `)
})

test("default values don't overwrite unless explicitly passed", async function () {
	const docs = [
		mockCollectedDoc(
			`
                query AllUsers {
                    ...QueryFragment
                }
            `
		),
		mockCollectedDoc(
			`
                fragment QueryFragment on Query 
                @arguments(name: {type: "String", default: "Hello"}) {
                    ...InnerFragment
                }
            `
		),
		mockCollectedDoc(
			`
                fragment InnerFragment on Query 
                @arguments(name: {type: "String", default: "Goodbye"}) {
                    users(stringValue: $name) { 
                        id
                    }
                }
            `
		),
	]

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	const queryContents = await fs.readFile(
		path.join(config.artifactPath(docs[0].document)),
		'utf-8'
	)
	expect(queryContents).toBeTruthy()
	// parse the contents
	const parsedQuery: ProgramKind = recast.parse(queryContents, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
        module.exports = {
            name: "AllUsers",
            kind: "HoudiniQuery",
            hash: "65064d681cee9e6381a4f63605c9f33f7d6348fc6a7ac010f3f8ea6fabf3c8ee",

            raw: \`query AllUsers {
          ...QueryFragment
        }

        fragment QueryFragment on Query {
          ...InnerFragment
        }

        fragment InnerFragment on Query {
          users(stringValue: "Goodbye") {
            id
          }
        }
        \`,

            rootType: "Query",

            selection: {
                "users": {
                    "type": "User",
                    "keyRaw": "users(stringValue: \\"Goodbye\\")",

                    "fields": {
                        "id": {
                            "type": "ID",
                            "keyRaw": "id"
                        }
                    }
                }
            }
        };
    `)
})

test('default arguments', async function () {
	const docs = [
		mockCollectedDoc(
			`
                query AllUsers {
                    ...QueryFragment
                }
            `
		),
		mockCollectedDoc(
			`
                fragment QueryFragment on Query 
                @arguments(name: {type: "String", default: "Hello"}, cool: {type: "Boolean", default: true}) {
                    users(boolValue: $cool, stringValue: $name) { 
                        id
                    }
                }
            `
		),
	]

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	const queryContents = await fs.readFile(
		path.join(config.artifactPath(docs[0].document)),
		'utf-8'
	)
	expect(queryContents).toBeTruthy()
	// parse the contents
	const parsedQuery: ProgramKind = recast.parse(queryContents, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
        module.exports = {
            name: "AllUsers",
            kind: "HoudiniQuery",
            hash: "5c4a8d1fe2e117286ecdfbd273bf1beb2f71a0a3fd9ea6bc84fe97c394c1a836",

            raw: \`query AllUsers {
          ...QueryFragment
        }

        fragment QueryFragment on Query {
          users(boolValue: true, stringValue: "Hello") {
            id
          }
        }
        \`,

            rootType: "Query",

            selection: {
                "users": {
                    "type": "User",
                    "keyRaw": "users(boolValue: true, stringValue: \\"Hello\\")",

                    "fields": {
                        "id": {
                            "type": "ID",
                            "keyRaw": "id"
                        }
                    }
                }
            }
        };
    `)
})

test('multiple with directives - no overlap', async function () {
	const docs = [
		mockCollectedDoc(
			`
                query AllUsers {
                    ...QueryFragment @with(name: "Goodbye") @with(cool: false)
                }
            `
		),
		mockCollectedDoc(
			`
                fragment QueryFragment on Query 
                @arguments(name: {type: "String", default: "Hello"}, cool: {type: "Boolean", default: true}) {
                    users(boolValue: $cool, stringValue: $name) { 
                        id
                    }
                }
            `
		),
	]

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	const queryContents = await fs.readFile(
		path.join(config.artifactPath(docs[0].document)),
		'utf-8'
	)
	expect(queryContents).toBeTruthy()
	// parse the contents
	const parsedQuery: ProgramKind = recast.parse(queryContents, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
        module.exports = {
            name: "AllUsers",
            kind: "HoudiniQuery",
            hash: "7327e6f7f6c8339feebb640b995c3e25efe1b25de29b1f43cb55c2a0566f713f",

            raw: \`query AllUsers {
          ...QueryFragment_2prn0K
        }

        fragment QueryFragment_2prn0K on Query {
          users(boolValue: false, stringValue: "Goodbye") {
            id
          }
        }
        \`,

            rootType: "Query",

            selection: {
                "users": {
                    "type": "User",
                    "keyRaw": "users(boolValue: false, stringValue: \\"Goodbye\\")",

                    "fields": {
                        "id": {
                            "type": "ID",
                            "keyRaw": "id"
                        }
                    }
                }
            }
        };
    `)
})
