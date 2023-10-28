import { defineConfig } from 'tsup'

export default defineConfig((options) => {
    return {
        outDir: './dist/bin/',
        entry: {
            'app': 'src/index.ts'
        },
        splitting: false,
        sourcemap: process.env['TSUP_ENV'] !== 'production',
        minify: !options.watch,
    }
})
