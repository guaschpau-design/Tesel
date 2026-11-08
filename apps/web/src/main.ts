// First: in the Android app, what stands in for the browser's APIs (lib/native).
import './lib/native/install.ts';

import { mount } from 'svelte';

import App from './App.svelte';
import './app.css';

const target = document.getElementById('app');
if (!target) throw new Error('index.html must contain #app');

export default mount(App, { target });
