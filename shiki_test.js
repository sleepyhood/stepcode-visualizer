import { getHighlighter } from 'shiki';

getHighlighter({themes:['one-dark-pro'], langs:['c']}).then(h => {
    const html = h.codeToHtml('int main() { int x = 1; printf("A"); return 0; }', {
        lang: 'c',
        theme: 'one-dark-pro',
        transformers: [
            {
                line(node, line) {
                    node.properties['data-line'] = line;
                    node.properties['data-lang'] = 'c';
                    node.properties['data-target'] = 'code';
                },
                span(node) {
                    const textNode = node.children[0];
                    if (textNode && textNode.type === 'text') {
                        node.properties['data-token-text'] = textNode.value.trim();
                    }
                },
            },
        ],
    });
    console.log(html);
});
