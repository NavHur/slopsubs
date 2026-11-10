// Adapted from fleet's pbp oxlint plugin. Scores SonarSource Cognitive
// Complexity (whitepaper v1.7), including nested functions in their owner.

const FUNCTIONS = new Set([
	"FunctionDeclaration",
	"FunctionExpression",
	"ArrowFunctionExpression",
]);
const LOOPS = new Set([
	"ForStatement",
	"ForInStatement",
	"ForOfStatement",
	"WhileStatement",
	"DoWhileStatement",
]);
const SKIPPED_KEYS = new Set([
	"parent",
	"loc",
	"range",
	"start",
	"end",
	"type",
	"leadingComments",
	"trailingComments",
]);

function identifierName(node) {
	return node.type === "Identifier" ? node.name : "<anonymous>";
}

function propertyName(parent) {
	if (
		["Property", "MethodDefinition", "PropertyDefinition"].includes(
			parent?.type,
		) &&
		!parent.computed
	) {
		return parent.key.name ?? String(parent.key.value ?? "<anonymous>");
	}
	return "<anonymous>";
}

function functionName(node) {
	if (node.id?.name) return node.id.name;
	const parent = node.parent;
	switch (parent?.type) {
		case "VariableDeclarator":
			return identifierName(parent.id);
		case "AssignmentExpression":
			return identifierName(parent.left);
		default:
			return propertyName(parent);
	}
}

// A bare name in a method or object property refers to an outer binding, so
// those recurse only through `this.name`.
function ownCallForms(node) {
	const name = functionName(node);
	if (name === "<anonymous>") return new Set();
	if (
		["MethodDefinition", "PropertyDefinition", "Property"].includes(
			node.parent?.type,
		)
	) {
		return new Set([`this.${name}`]);
	}
	return new Set([name]);
}

function callForm(callee) {
	if (callee.type === "Identifier") return callee.name;
	if (
		callee.type === "MemberExpression" &&
		!callee.computed &&
		callee.object.type === "ThisExpression"
	) {
		return `this.${callee.property.name}`;
	}
	return null;
}

function isNode(value) {
	return value && typeof value.type === "string";
}

function nodesIn(value) {
	if (Array.isArray(value)) return value.filter(isNode);
	return isNode(value) ? [value] : [];
}

function children(node) {
	return Object.keys(node)
		.filter((key) => !SKIPPED_KEYS.has(key))
		.flatMap((key) => nodesIn(node[key]));
}

// Operators of a logical chain in source order; `??` and non-logical nodes end it.
function chainOperators(node, seen, operators = []) {
	if (node?.type !== "LogicalExpression" || node.operator === "??")
		return operators;
	seen.add(node);
	chainOperators(node.left, seen, operators);
	operators.push(node.operator);
	chainOperators(node.right, seen, operators);
	return operators;
}

function runs(operators) {
	return operators.filter(
		(operator, index) => operator !== operators[index - 1],
	).length;
}

function visitChildren(node, nesting, state) {
	for (const child of children(node)) walk(child, nesting, state);
}

function visitFunction(node, nesting, state) {
	state.frames.push({ forms: ownCallForms(node), counted: false });
	const depth = node === state.root ? nesting : nesting + 1;
	visitChildren(node, depth, state);
	state.frames.pop();
}

function visitConditional(node, nesting, state) {
	state.total += 1 + nesting;
	walk(node.test, nesting, state);
	walk(node.consequent, nesting + 1, state);
	walk(node.alternate, nesting + 1, state);
}

function visitLoop(node, nesting, state) {
	state.total += 1 + nesting;
	for (const child of children(node)) {
		walk(child, child === node.body ? nesting + 1 : nesting, state);
	}
}

function visitSwitch(node, nesting, state) {
	state.total += 1 + nesting;
	walk(node.discriminant, nesting, state);
	for (const branch of node.cases) visitChildren(branch, nesting + 1, state);
}

function visitCatch(node, nesting, state) {
	state.total += 1 + nesting;
	walk(node.param, nesting, state);
	walk(node.body, nesting + 1, state);
}

function visitIf(node, nesting, state) {
	state.total += 1 + nesting;
	visitIfBranches(node, nesting, state);
}

// An `else if` continues its chain at the same nesting and costs one.
function visitElseIf(node, nesting, state) {
	state.total += 1;
	visitIfBranches(node, nesting, state);
}

function visitIfBranches(node, nesting, state) {
	walk(node.test, nesting, state);
	walk(node.consequent, nesting + 1, state);
	visitAlternate(node.alternate, nesting, state);
}

function visitAlternate(node, nesting, state) {
	if (!node) return;
	if (node.type === "IfStatement") return visitElseIf(node, nesting, state);
	state.total += 1;
	walk(node, nesting + 1, state);
}

function countLogical(node, state) {
	if (node.operator === "??" || state.seenChains.has(node)) return;
	state.total += runs(chainOperators(node, state.seenChains));
}

function countRecursion(node, state) {
	const frame = state.frames.at(-1);
	const form = callForm(node.callee);
	if (frame && !frame.counted && form && frame.forms.has(form)) {
		frame.counted = true;
		state.total += 1;
	}
}

const VISITORS = {
	FunctionDeclaration: visitFunction,
	FunctionExpression: visitFunction,
	ArrowFunctionExpression: visitFunction,
	IfStatement: visitIf,
	ConditionalExpression: visitConditional,
	SwitchStatement: visitSwitch,
	CatchClause: visitCatch,
};
for (const type of LOOPS) VISITORS[type] = visitLoop;

function countExpression(node, state) {
	switch (node.type) {
		case "LogicalExpression":
			countLogical(node, state);
			break;
		case "BreakStatement":
		case "ContinueStatement":
			if (node.label) state.total += 1;
			break;
		case "CallExpression":
		case "NewExpression":
			countRecursion(node, state);
			break;
	}
}

function walk(node, nesting, state) {
	if (!node) return;
	const visitor = VISITORS[node.type];
	if (visitor) return visitor(node, nesting, state);
	countExpression(node, state);
	visitChildren(node, nesting, state);
}

function score(root) {
	const state = { root, total: 0, seenChains: new WeakSet(), frames: [] };
	walk(root, 0, state);
	return state.total;
}

function enclosedByFunction(node) {
	for (let parent = node.parent; parent; parent = parent.parent) {
		if (FUNCTIONS.has(parent.type)) return true;
	}
	return false;
}

const cognitiveComplexity = {
	meta: {
		type: "suggestion",
		docs: {
			description:
				"Cognitive Complexity of each top-level function, nested functions included.",
		},
		schema: [
			{
				type: "object",
				properties: { max: { type: "integer", minimum: 0 } },
				additionalProperties: false,
			},
		],
	},
	create(context) {
		const max = context.options[0]?.max ?? 6;
		function check(node) {
			if (enclosedByFunction(node)) return;
			const value = score(node);
			if (value > max) {
				context.report({
					node,
					message: `Function \`${functionName(node)}\` has cognitive complexity ${value}, above the limit of ${max}.`,
				});
			}
		}
		return {
			FunctionDeclaration: check,
			FunctionExpression: check,
			ArrowFunctionExpression: check,
		};
	},
};

export default {
	meta: { name: "pbp" },
	rules: { "cognitive-complexity": cognitiveComplexity },
};
