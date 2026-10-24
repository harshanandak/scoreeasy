import { plugin } from 'bun';
plugin({ name: 'css-stub', setup(b) { b.onLoad({ filter: /\.css$/ }, () => ({ contents: '', loader: 'js' })); } });
