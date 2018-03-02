import buble from 'rollup-plugin-buble';
import builtins from 'rollup-plugin-node-builtins';
import commonjs from 'rollup-plugin-commonjs';
import uglify from 'rollup-plugin-uglify';

export default {
    input: 'browser.js',
    output: {
        file: 'dist/passage-rpc.min.js',
        format: 'iife',
        name: 'Passage'
    },
    plugins: [
        builtins(),
        commonjs(),
        buble({ transforms: { dangerousForOf: true } }),
        uglify()
    ]
};
