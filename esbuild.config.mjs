/*
 * Taken from https://github.com/nothingislost/obsidian-cm6-attributes/blob/master/esbuild.config.mjs
 */

import esbuild from 'esbuild';
import process from 'process';


const prod = process.argv[2] === 'production';
const banner = `/*
THIS FILE WAS GENERATED AUTOMATICALLY.
You can view the source at https://github.com/bicarlsen/obsidian_image_caption.
*/`

esbuild.build({
    minify: prod ? true : false,
    banner: { 'js': banner },
    entryPoints: [ 'src/main.ts' ],
    bundle: true,
    external: [
        "obsidian", 
        "codemirror",
        "@codemirror/view",
        "@codemirror/language"
    ],
    format: 'cjs',
    watch: !prod,
    target: 'es2016',
    logLevel: 'info',
    sourcemap: prod ? false : 'inline',
    treeShaking: true,
    outfile: 'main.js'
}).catch( () => process.exit( 1 ) );
