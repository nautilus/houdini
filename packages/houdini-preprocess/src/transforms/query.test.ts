// local imports
import '../../../../jest.setup'
import { preprocessorTest } from '../utils'

describe('query preprocessor', function () {
	test('route - preload initial data', async function () {
		const doc = await preprocessorTest(
			`
            <script>
                const { data } = query(graphql\`
                    query TestQuery {
                        viewer {
                            id
                        }
                    }
                \`)
            </script>
        `
		)

		// make sure we added the right stuff
		expect(doc.module?.content).toMatchInlineSnapshot(`
        import { convertKitPayload } from "$houdini";
        import { fetchQuery, RequestContext } from "$houdini";
        import _TestQueryArtifact from "$houdini/artifacts/TestQuery";
        import { houdiniConfig } from "$houdini";

        export async function load(context) {
            const _houdini_context = new RequestContext(context);
            const _TestQuery_Input = {};

            if (!_houdini_context.continue) {
                return _houdini_context.returnValue;
            }

            const _TestQuery = await fetchQuery(_houdini_context, {
                "hash": _TestQueryArtifact.hash,
                "text": _TestQueryArtifact.raw,
                "variables": _TestQuery_Input
            }, context.session);

            if (!_TestQuery.data) {
                _houdini_context.graphqlErrors(_TestQuery);
                return _houdini_context.returnValue;
            }

            return {
                props: {
                    _TestQuery: _TestQuery,
                    _TestQuery_Input: _TestQuery_Input
                }
            };
        }

        export function preload(page, session) {
            return convertKitPayload(this, load, page, session);
        }
    `)
		expect(doc.instance?.content).toMatchInlineSnapshot(`
        import { routeQuery, componentQuery, query } from "$houdini";
        export let _TestQuery = undefined;
        export let _TestQuery_Input = undefined;

        let _TestQuery_handler = query({
            "config": houdiniConfig,
            "initialValue": _TestQuery,
            "variables": _TestQuery_Input,
            "kind": "HoudiniQuery",
            "artifact": _TestQueryArtifact
        });

        const {
            data
        } = routeQuery(_TestQuery_handler);

        $:
        {
            _TestQuery_handler.writeData(_TestQuery, _TestQuery_Input);
        }
    `)
	})

	test('preload initial data with variables', async function () {
		const doc = await preprocessorTest(
			`
            <script context="module">
                export function TestQueryVariables(page) {
                    return {
                        test: true
                    }
                }
            </script>

            <script>
                const { data } = query(graphql\`
                    query TestQuery($test: Boolean!) {
                        viewer {
                            id
                        }
                    }
                \`)
            </script>
        `
		)

		// make sure we added the right stuff
		expect(doc.module?.content).toMatchInlineSnapshot(`
        import { convertKitPayload } from "$houdini";
        import { fetchQuery, RequestContext } from "$houdini";
        import _TestQueryArtifact from "$houdini/artifacts/TestQuery";
        import { houdiniConfig } from "$houdini";

        export function TestQueryVariables(page) {
            return {
                test: true
            };
        }

        export async function load(context) {
            const _houdini_context = new RequestContext(context);

            const _TestQuery_Input = _houdini_context.computeInput({
                "config": houdiniConfig,
                "mode": "sapper",
                "variableFunction": TestQueryVariables,
                "artifact": _TestQueryArtifact
            });

            if (!_houdini_context.continue) {
                return _houdini_context.returnValue;
            }

            const _TestQuery = await fetchQuery(_houdini_context, {
                "hash": _TestQueryArtifact.hash,
                "text": _TestQueryArtifact.raw,
                "variables": _TestQuery_Input
            }, context.session);

            if (!_TestQuery.data) {
                _houdini_context.graphqlErrors(_TestQuery);
                return _houdini_context.returnValue;
            }

            return {
                props: {
                    _TestQuery: _TestQuery,
                    _TestQuery_Input: _TestQuery_Input
                }
            };
        }

        export function preload(page, session) {
            return convertKitPayload(this, load, page, session);
        }
    `)
		expect(doc.instance?.content).toMatchInlineSnapshot(`
        import { routeQuery, componentQuery, query } from "$houdini";
        export let _TestQuery = undefined;
        export let _TestQuery_Input = undefined;

        let _TestQuery_handler = query({
            "config": houdiniConfig,
            "initialValue": _TestQuery,
            "variables": _TestQuery_Input,
            "kind": "HoudiniQuery",
            "artifact": _TestQueryArtifact
        });

        const {
            data
        } = routeQuery(_TestQuery_handler);

        $:
        {
            _TestQuery_handler.writeData(_TestQuery, _TestQuery_Input);
        }
    `)
	})

	test('sveltekit', async function () {
		const doc = await preprocessorTest(
			`
            <script>
                const { data } = query(graphql\`
                    query TestQuery {
                        viewer {
                            id
                        }
                    }
                \`)
            </script>
        `,
			{
				mode: 'kit',
				route: true,
			}
		)

		// make sure we added the right stuff
		expect(doc.module?.content).toMatchInlineSnapshot(`
        import { fetchQuery, RequestContext } from "$houdini";
        import _TestQueryArtifact from "$houdini/artifacts/TestQuery";
        import { houdiniConfig } from "$houdini";

        export async function load(context) {
            const _houdini_context = new RequestContext(context);
            const _TestQuery_Input = {};

            if (!_houdini_context.continue) {
                return _houdini_context.returnValue;
            }

            const _TestQuery = await fetchQuery(_houdini_context, {
                "hash": _TestQueryArtifact.hash,
                "text": _TestQueryArtifact.raw,
                "variables": _TestQuery_Input
            }, context.session);

            if (!_TestQuery.data) {
                _houdini_context.graphqlErrors(_TestQuery);
                return _houdini_context.returnValue;
            }

            return {
                props: {
                    _TestQuery: _TestQuery,
                    _TestQuery_Input: _TestQuery_Input
                }
            };
        }
    `)
		expect(doc.instance?.content).toMatchInlineSnapshot(`
        import { routeQuery, componentQuery, query } from "$houdini";
        export let _TestQuery = undefined;
        export let _TestQuery_Input = undefined;

        let _TestQuery_handler = query({
            "config": houdiniConfig,
            "initialValue": _TestQuery,
            "variables": _TestQuery_Input,
            "kind": "HoudiniQuery",
            "artifact": _TestQueryArtifact
        });

        const {
            data
        } = routeQuery(_TestQuery_handler);

        $:
        {
            _TestQuery_handler.writeData(_TestQuery, _TestQuery_Input);
        }
    `)
	})

	test('svelte kit with static set', async function () {
		const doc = await preprocessorTest(
			`
            <script>
                const { data } = query(graphql\`
                    query TestQuery {
                        viewer {
                            id
                        }
                    }
                \`)
            </script>
        `,
			{
				mode: 'kit',
				// if we are in a route but static is set to true, we need to treat the file like a
				// svelte component
				route: true,
				static: true,
			}
		)

		// make sure we added the right stuff
		expect(doc.module?.content).toMatchInlineSnapshot(
			`import { houdiniConfig } from "$houdini";`
		)
		expect(doc.instance?.content).toMatchInlineSnapshot(`
        import { routeQuery, componentQuery, query } from "$houdini";
        import _TestQueryArtifact from "$houdini/artifacts/TestQuery";
        export let _TestQuery = undefined;
        export let _TestQuery_Input = undefined;

        let _TestQuery_handler = query({
            "config": houdiniConfig,
            "initialValue": _TestQuery,
            "variables": _TestQuery_Input,
            "kind": "HoudiniQuery",
            "artifact": _TestQueryArtifact
        });

        const {
            data
        } = componentQuery({
            queryHandler: _TestQuery_handler,
            config: houdiniConfig,
            artifact: _TestQueryArtifact,
            variableFunction: null,
            getProps: () => $$props
        });
    `)
	})

	test('non-route page - no variables', async function () {
		const doc = await preprocessorTest(
			`
            <script>
                const { data } = query(graphql\`
                    query TestQuery {
                        viewer {
                            id
                        }
                    }
                \`)
            </script>
        `,
			{
				mode: 'kit',
				route: false,
			}
		)

		// make sure we added the right stuff
		expect(doc.module?.content).toMatchInlineSnapshot(
			`import { houdiniConfig } from "$houdini";`
		)
		expect(doc.instance?.content).toMatchInlineSnapshot(`
        import { routeQuery, componentQuery, query } from "$houdini";
        import _TestQueryArtifact from "$houdini/artifacts/TestQuery";
        export let _TestQuery = undefined;
        export let _TestQuery_Input = undefined;

        let _TestQuery_handler = query({
            "config": houdiniConfig,
            "initialValue": _TestQuery,
            "variables": _TestQuery_Input,
            "kind": "HoudiniQuery",
            "artifact": _TestQueryArtifact
        });

        const {
            data
        } = componentQuery({
            queryHandler: _TestQuery_handler,
            config: houdiniConfig,
            artifact: _TestQueryArtifact,
            variableFunction: null,
            getProps: () => $$props
        });
    `)
	})

	test('non-route page - with variables', async function () {
		const doc = await preprocessorTest(
			`
            <script>
                const { data } = query(graphql\`
                    query TestQuery($test: String!) {
                        users(stringValue: $test) {
                            id
                        }
                    }
                \`)
            </script>
        `,
			{
				mode: 'kit',
				route: false,
			}
		)

		// make sure we added the right stuff
		expect(doc.module?.content).toMatchInlineSnapshot(
			`import { houdiniConfig } from "$houdini";`
		)
		expect(doc.instance?.content).toMatchInlineSnapshot(`
        import { routeQuery, componentQuery, query } from "$houdini";
        import _TestQueryArtifact from "$houdini/artifacts/TestQuery";
        export let _TestQuery = undefined;
        export let _TestQuery_Input = undefined;

        let _TestQuery_handler = query({
            "config": houdiniConfig,
            "initialValue": _TestQuery,
            "variables": _TestQuery_Input,
            "kind": "HoudiniQuery",
            "artifact": _TestQueryArtifact
        });

        const {
            data
        } = componentQuery({
            queryHandler: _TestQuery_handler,
            config: houdiniConfig,
            artifact: _TestQueryArtifact,
            variableFunction: TestQueryVariables,
            getProps: () => $$props
        });
    `)
	})

	test('bare svelte component in route filepath', async function () {
		const doc = await preprocessorTest(
			`
            <script>
                const { data } = query(graphql\`
                    query TestQuery {
                        viewer {
                            id
                        }
                    }
                \`)
            </script>
        `,
			{
				framework: 'svelte',
				route: true,
			}
		)

		// make sure we added the right stuff
		expect(doc.module?.content).toMatchInlineSnapshot(
			`import { houdiniConfig } from "$houdini";`
		)
		expect(doc.instance?.content).toMatchInlineSnapshot(`
        import { routeQuery, componentQuery, query } from "$houdini";
        import _TestQueryArtifact from "$houdini/artifacts/TestQuery";
        export let _TestQuery = undefined;
        export let _TestQuery_Input = undefined;

        let _TestQuery_handler = query({
            "config": houdiniConfig,
            "initialValue": _TestQuery,
            "variables": _TestQuery_Input,
            "kind": "HoudiniQuery",
            "artifact": _TestQueryArtifact
        });

        const {
            data
        } = componentQuery({
            queryHandler: _TestQuery_handler,
            config: houdiniConfig,
            artifact: _TestQueryArtifact,
            variableFunction: null,
            getProps: () => $$props
        });
    `)
	})

	test.todo('fails if variable function is not present')

	test.todo('adds arguments to an empty preload')
})
