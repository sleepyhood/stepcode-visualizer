const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildTokenRegex(token) {
    const escaped = escapeRegExp(token);
    if (IDENTIFIER_PATTERN.test(token)) {
        return new RegExp(`(?<![A-Za-z0-9_])${escaped}(?![A-Za-z0-9_])`, 'g');
    }
    return new RegExp(escaped, 'g');
}

function clampOccurrenceIndex(index, length) {
    if (!length) return 0;
    if (index < 0) return 0;
    if (index >= length) return length - 1;
    return index;
}

function buildLinePreview(lineText, token) {
    const normalized = lineText.trim().replace(/\s+/g, ' ');
    if (!normalized) return token;
    if (normalized.length <= 28) return normalized;

    const matchIndex = normalized.indexOf(token);
    if (matchIndex === -1) {
        return `${normalized.slice(0, 25)}...`;
    }

    const start = Math.max(0, matchIndex - 8);
    const end = Math.min(normalized.length, matchIndex + token.length + 12);
    const prefix = start > 0 ? '...' : '';
    const suffix = end < normalized.length ? '...' : '';
    return `${prefix}${normalized.slice(start, end)}${suffix}`;
}

export function findAnchorOccurrences(sourceCode, consoleOutput, anchor) {
    if (!anchor?.text) return [];

    const regex = buildTokenRegex(anchor.text);
    const occurrences = [];

    if (anchor.target === 'console') {
        const lines = consoleOutput.split('\n');
        lines.forEach((lineText, lineIndex) => {
            let localIndex = 0;
            for (const matchResult of lineText.matchAll(regex)) {
                void matchResult;
                occurrences.push({
                    line: lineIndex + 1,
                    occurrenceIndex: localIndex,
                    preview: buildLinePreview(lineText, anchor.text),
                    text: anchor.text,
                    target: anchor.target,
                });
                localIndex += 1;
            }
        });
        return occurrences;
    }

    const lines = sourceCode.split('\n');
    lines.forEach((lineText, lineIndex) => {
        let localIndex = 0;
        for (const matchResult of lineText.matchAll(regex)) {
            void matchResult;
            occurrences.push({
                line: lineIndex + 1,
                occurrenceIndex: localIndex,
                preview: buildLinePreview(lineText, anchor.text),
                text: anchor.text,
                target: anchor.target,
            });
            localIndex += 1;
        }
    });
    return occurrences;
}

export function getAnchorSelectOptions(sourceCode, consoleOutput, anchor) {
    const occurrences = findAnchorOccurrences(sourceCode, consoleOutput, anchor);
    return occurrences.map((occurrence, index) => ({
        ...occurrence,
        value: `${occurrence.line}:${occurrence.occurrenceIndex}`,
        label: `${index + 1}번째 (${occurrence.line}행: ${occurrence.preview})`,
    }));
}

export function resolveAnchorSelection(sourceCode, consoleOutput, anchor, selectedValue) {
    const options = getAnchorSelectOptions(sourceCode, consoleOutput, anchor);
    const selected = options.find((option) => option.value === selectedValue) ?? options[0];
    if (!selected) {
        return {
            ...anchor,
            occurrenceIndex: 0,
        };
    }

    return {
        ...anchor,
        line: selected.line,
        occurrenceIndex: selected.occurrenceIndex,
    };
}

export function normalizeAnchor(sourceCode, consoleOutput, anchor) {
    const options = getAnchorSelectOptions(sourceCode, consoleOutput, anchor);
    if (!options.length) {
        return {
            ...anchor,
            occurrenceIndex: anchor.occurrenceIndex ?? 0,
        };
    }

    const matched = options.find((option) => (
        option.line === anchor.line &&
        option.occurrenceIndex === (anchor.occurrenceIndex ?? 0)
    ));

    const selected = matched ?? options[clampOccurrenceIndex(anchor.occurrenceIndex ?? 0, options.length)];

    return {
        ...anchor,
        line: selected.line,
        occurrenceIndex: selected.occurrenceIndex,
    };
}

export function normalizeAnnotations(sourceCode, consoleOutput, annotations) {
    return annotations.map((annotation) => ({
        ...annotation,
        from: normalizeAnchor(sourceCode, consoleOutput, annotation.from),
        to: annotation.to ? normalizeAnchor(sourceCode, consoleOutput, annotation.to) : annotation.to,
    }));
}

export function doesAnchorMatchToken(anchor, currentLine, tokenText, occurrenceIndex) {
    if (!anchor) return false;
    if (anchor.text !== tokenText) return false;
    if (anchor.line !== undefined && anchor.line !== currentLine) return false;
    return (anchor.occurrenceIndex ?? 0) === occurrenceIndex;
}
