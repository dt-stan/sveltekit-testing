import { fetchProducts } from "$lib/server/product";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  const { articleId } = event.params;

  console.log("This is our load function");

  const responseBody = await fetch(
    `https://jsonplaceholder.typicode.com/posts/${articleId}`
  ).then((res) => {
    if (!res.ok) {
      throw new Error("Failed to fetch blog article");
    }
    return res.json();
  });

  
  return {
    title: responseBody.title,
    blogArticle: responseBody.body,
    relatedProducts: await fetchProducts(),
  };
};
