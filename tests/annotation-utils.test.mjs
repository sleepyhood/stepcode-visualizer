import test from 'node:test';
import assert from 'node:assert/strict';

import {
    doesAnchorMatchToken,
    getAnchorSelectOptions,
    normalizeAnnotations,
    resolveAnchorSelection,
} from '../components/code-guide/annotation-utils.js';

const sourceCode = `#include <stdio.h>

int main() {
    int ch1, ch2;

    ch1 = getchar();
    ch2 = getchar();

    printf("Result: %c %c\\n", ch1, ch2);
    return 0;
}`;

const consoleOutput = `A
Result: A`;

test('getAnchorSelectOptions lists code duplicates with line context', () => {
    const options = getAnchorSelectOptions(sourceCode, consoleOutput, {
        target: 'code',
        text: 'int',
    });

    assert.equal(options.length, 2);
    assert.equal(options[0].value, '3:0');
    assert.match(options[0].label, /1번째 \(3행: int main\(\) \{/);
    assert.equal(options[1].value, '4:0');
    assert.match(options[1].label, /2번째 \(4행: int ch1, ch2;/);
});

test('resolveAnchorSelection updates both line and occurrence index', () => {
    const nextAnchor = resolveAnchorSelection(sourceCode, consoleOutput, {
        target: 'code',
        text: 'int',
    }, '4:0');

    assert.deepEqual(nextAnchor, {
        target: 'code',
        text: 'int',
        line: 4,
        occurrenceIndex: 0,
    });
});

test('normalizeAnnotations fills in missing line information for console anchors', () => {
    const [annotation] = normalizeAnnotations(sourceCode, consoleOutput, [{
        id: 'anno-2',
        type: 'arrow',
        visible: true,
        color: 'blue',
        from: {
            target: 'console',
            text: 'Result:',
        },
        to: {
            target: 'code',
            line: 8,
            text: 'printf',
        },
    }]);

    assert.equal(annotation.from.line, 2);
    assert.equal(annotation.from.occurrenceIndex, 0);
});

test('doesAnchorMatchToken respects console line and occurrence index', () => {
    const anchor = {
        target: 'console',
        text: 'A',
        line: 2,
        occurrenceIndex: 0,
    };

    assert.equal(doesAnchorMatchToken(anchor, 1, 'A', 0), false);
    assert.equal(doesAnchorMatchToken(anchor, 2, 'A', 0), true);
});
