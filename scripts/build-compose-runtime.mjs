import {build} from 'esbuild';
await build({entryPoints:['apps/neurolab-web/lib/composeRuntime.ts'],outfile:'apps/neurolab-web/public/runtime/compose-runtime.mjs',bundle:true,format:'esm',platform:'neutral',target:'es2022',minify:false,legalComments:'eof'});
