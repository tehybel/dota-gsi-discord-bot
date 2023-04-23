/* eslint-disable max-statements */
import Fact from "../src/engine/Fact";
import Rule from "../src/engine/Rule";
import Topic from "../src/engine/Topic";

/* eslint-disable sort-keys */
expect.extend({
    toBeWithinRange(actual, min, max) {
        if (typeof actual !== "number") {
            throw new Error("Actual value must be a number");
        }

        const pass = actual >= min && actual <= max;

        return {
            pass,
            message: pass
                ? () =>
                      `expected ${actual} not to be within range (${min}..${max})`
                : () =>
                      `expected ${actual} to be within range (${min}..${max})`,
        };
    },

    setContaining(actual, expected) {
        if (!(actual instanceof Set)) {
            throw new Error("Actual value must be a Set");
        }

        const pass = expected.every((item) => actual.has(item));

        return {
            pass,
            message: pass
                ? () => `expected Set not to contain ${expected.join(", ")}`
                : () => `expected Set to contain ${expected.join(", ")}`,
        };
    },

    toContainFact(actual, label, value) {
        if (actual === undefined) {
            throw new Error("Did not recieve any Facts. Recieved undefined");
        }
        const actualArr = Array.isArray(actual) ? actual : [actual];
        const factArray = actualArr.filter((fact) => fact instanceof Fact);
        if (factArray.length === 0) {
            throw new Error(
                `Received ${actual}. Expected to recieve at least one Fact objects (Currently not handling Promise<Fact>).`
            );
        }

        const fact = (actualArr as Fact<unknown>[]).find(
            (f) => f.topic.label === label
        );

        let message: string;
        const factExists = fact !== undefined;
        message = factExists
            ? `Fact ${label} exists `
            : `Fact ${label} does not exist `;
        const correctValue = this.equals(fact?.value, value);
        message += correctValue
            ? `with value ${value}`
            : `with incorrect value ${fact?.value} (expected ${value})`;
        const pass = factExists && correctValue;

        return {
            pass,
            message: pass
                ? () => `${message}. Expected to contain no such fact.`
                : () => `${message}`,
        };
    },

    toContainTopic(actual, label) {
        if (actual === undefined) {
            throw new Error("Did not recieve any Facts. Recieved undefined");
        }
        const actualArr = Array.isArray(actual) ? actual : [actual];
        const factArray = actualArr.filter((fact) => fact instanceof Fact);
        if (factArray.length === 0) {
            throw new Error(
                `Received ${actual}. Expected to recieve at least one Fact objects (Currently not handling Promise<Fact>).`
            );
        }

        const fact = (actualArr as Fact<unknown>[]).find(
            (f) => f.topic.label === label
        );

        const pass = fact !== undefined;

        return {
            pass,
            message: pass
                ? () =>
                      `Topic ${label} exists. Expected to contain no such topic.`
                : () => `Topic ${label} does not exist`,
        };
    },
});

const makeGetFunction =
    (input: { [keys: string]: unknown }) =>
    <T>(t: Topic<T>): T =>
        input[t.label] as T;

// NOTE: Cannot re-use the existing code in topicManager
// because the import will mess with jest.mock("topicManager")
function factsToPlainObject(facts: Fact<unknown>[]) {
    return facts.reduce((memo: { [key: string]: unknown }, fact) => {
        memo[fact.topic.label] = fact.value;
        return memo;
    }, {});
}

// TODO refactor to be in function() format
// TODO refactor to be able to take in a list of rules instead of just a single rule
const getResults = (
    rule: Rule,
    db: { [keys: string]: unknown },
    previousState?: Fact<unknown>[] | Fact<unknown>
) => {
    if (previousState) {
        const arrPreviousState = Array.isArray(previousState)
            ? previousState
            : [previousState];
        return rule.then(
            makeGetFunction({ ...factsToPlainObject(arrPreviousState), ...db })
        );
    } else {
        return rule.then(makeGetFunction(db));
    }
};

global.getResults = getResults as any;
