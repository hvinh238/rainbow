// services/api.ts
const API_BASE = 'https://openlibrary.org';

export interface Book {
  title: string;
  author_name?: string[];
  cover_i?: number;
  key: string;
  first_publish_year?: number;
}

export const searchBooks = async (query: string = 'programming', page: number = 1): Promise<{ docs: Book[] }> => {
  try {
    const response = await fetch(
      `${API_BASE}/search.json?q=${encodeURIComponent(query)}&page=${page}&limit=20`
    );
    if (!response.ok) {
      throw new Error('Tìm kiếm thất bại. Vui lòng thử lại.');
    }
    const data = await response.json();
    return data;  // Trả về { docs: [...] }
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};