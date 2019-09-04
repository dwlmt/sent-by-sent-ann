import App from './App.svelte';

const app = new App({
	target: document.body,
	props: {
		name: 'Sentence Story Annotation'
	}
});

export default app;