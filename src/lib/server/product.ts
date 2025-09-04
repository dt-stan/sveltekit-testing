// Fetch product data from external API
export async function fetchProducts() {
	const response = await fetch('https://api.escuelajs.co/api/v1/products');
	if (!response.ok) {
		throw new Error('Failed to fetch products');
	}
	return await response.json();
}
