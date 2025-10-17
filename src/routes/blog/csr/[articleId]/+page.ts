// import { fetchProducts } from "$lib/server/product";
// import type { PageServerLoad } from "./$types";

export const ssr = false;

export async function load({ params }) {
  const { articleId } = params;

  console.log("This is our load function");

  const response = await fetch(
    `https://jsonplaceholder.typicode.com/posts/${articleId}`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch blog article");
  }

  const responseBody = await response.json();

  // You cannot use server-only imports like $lib/server/product in CSR
  // Consider moving fetchProducts to a shared module or calling an API endpoint instead

  return {
    title: responseBody.title,
    blogArticle: responseBody.body,
    relatedProducts: [] // Placeholder or fetch from a public API
  };
}
