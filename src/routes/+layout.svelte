<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<h2>Entry point of the blog</h2>

<a href="/blog/1">First article</a>
<a href="/blog/2">Second article</a>

{@render children?.()}
