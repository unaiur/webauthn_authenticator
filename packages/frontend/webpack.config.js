const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
//const WebpackBundleAnalyzer = require('webpack-bundle-analyzer');

module.exports = {
  entry: {
    auth: {
      import: path.join(__dirname, "src", "auth.ts"),
      filename: "auth/bundle.js",
    },
    register: {
      import: path.join(__dirname, "src", "register.ts"),
      filename: "register/bundle.js",
    },
  },
  mode: 'production',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif)$/i,
        type: 'asset/resource',
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        type: 'asset/resource',
      },

    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      hash: true,
      chunks: ['auth'],
      title: 'Authenticate',
      filename: 'auth/index.html',
    }),
    new HtmlWebpackPlugin({
      hash: true,
      chunks: ['register'],
      title: 'Register New Credential',
      filename: 'register/index.html'
    }),
    //new WebpackBundleAnalyzer.BundleAnalyzerPlugin(),
  ],
  optimization: {
    usedExports: true,
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
  },
};
