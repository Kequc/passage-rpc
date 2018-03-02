import buble from 'rollup-plugin-buble';
import commonjs from 'rollup-plugin-commonjs';
import resolve from 'rollup-plugin-node-resolve';
import uglify from 'rollup-plugin-uglify';

export default {
    input: 'browser.js',
    output: {
        file: 'dist/passage-rpc.min.js',
        format: 'iife',
        name: 'Passage'
    },
    plugins: [
        resolve({ browser: true }),
        commonjs(),
        buble({ transforms: { dangerousForOf: true } }),
        uglify()
    ]
};
