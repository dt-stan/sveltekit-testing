<script lang="ts">
  import { onMount } from 'svelte';
  import type { Product } from '$lib/server/product';

  export let data: { title: string; blogArticle: string; relatedProducts: Product[] };

</script>

<h1>{data.title}</h1>
<p>{data.blogArticle}</p>

<!-- Related Products List -->
{#if data.relatedProducts.length}
  <h2>Related Products</h2>
  <ul>
    {#each data.relatedProducts.slice(0, 5) as product}
      <li>
        <img src={product.images[0]} alt={product.title} width="50" height="50" />
        <strong>{product.title}</strong> - ${product.price}
      </li>
    {/each}
  </ul>
{/if}
