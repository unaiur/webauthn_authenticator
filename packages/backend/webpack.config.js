import { join, resolve as _resolve } from 'path';

export const entry = {
  main: {
    import: join(__dirname, "src", "index.ts"),
    filename: "bin/index.js",
  },
};
export const mode = 'production';
export const module = {
  rules: [
    {
      test: /\.tsx?$/,
      use: 'ts-loader',
      exclude: /node_modules/,
    },
  ],
};
export const optimization = {
  usedExports: true,
};
export const resolve = {
  extensions: ['.tsx', '.ts', '.js'],
};
export const output = {
  path: _resolve(__dirname, 'dist'),
};
