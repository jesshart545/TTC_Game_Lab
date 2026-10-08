const assert = require('node:assert/strict');
const fs = require('node:fs');

const layout = fs.readFileSync('app/layout.tsx', 'utf8');
const css = fs.readFileSync('app/controls.css', 'utf8');

assert.match(layout, /import\s+["']\.\/controls\.css["'];/, 'Root layout must load the shared control stylesheet.');
assert.match(css, /input:not\(\[type=checkbox\]\):not\(\[type=radio\]\):not\(\[type=range\]\):not\(\[type=color\]\):not\(\[type=file\]\)/, 'Text-like inputs need the shared polished treatment.');
assert.match(css, /\bselect\b/, 'Select controls need shared styling.');
assert.match(css, /\btextarea\b/, 'Textareas need shared styling without a global height override.');
assert.match(css, /input\[type=checkbox\], input\[type=radio\], input\[type=range\]/, 'Checkbox, radio, and range inputs need native-friendly treatment.');
assert.match(css, /input\[type=color\]/, 'Color inputs need a dedicated treatment.');
assert.match(css, /:focus-visible/, 'Keyboard focus must remain visible.');
assert.match(css, /:disabled/, 'Disabled controls need a clear non-interactive state.');
assert.match(css, /:where\(\.workspace-page, \.projects-page, \.shell, \.asset-composer, \.media-editor-modal, \.card-creation-dialog\) :is\(\.outline-btn, \.build-btn, \.danger-btn\)/, 'Studio action controls must receive readable scoped sizing.');
assert.match(css, /\.asset-filter-tabs button/, 'Asset-library action filters must be readable.');
assert.match(css, /button:not\(\.timeline-clip\)/, 'Timeline clip geometry must not inherit the shared button baseline.');
assert.match(css, /\.stage button\[aria-label\^="Move "\]/, 'Canvas move handles must retain their precise geometry.');
assert.doesNotMatch(css, /textarea\s*\{[^}]*min-(?:height|block-size)/, 'The shared stylesheet must not globally enlarge every textarea.');

console.log('PASS: shared controls are imported; text, select, and textarea styling is accessible; native input types and precise studio/canvas targets are preserved.');
