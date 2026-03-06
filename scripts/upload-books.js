// upload-books.js
const admin = require('firebase-admin');
const axios = require('axios');

// Khởi tạo Firebase Admin SDK
const serviceAccount = require('./libary-10c0d-firebase-adminsdk-fbsvc-6a3585df2a.json');  // Thay bằng đường dẫn file JSON của bạn

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Cấu hình API
const API_BASE = 'https://openlibrary.org';
const QUERY = 'book';  // Query tìm kiếm rộng để lấy đa dạng sách
const LIMIT = 20;  // Sách mỗi trang
const TOTAL_PAGES = 25;  // 25 trang * 20 = 500 sách
const DELAY_MS = 1000;  // Delay 1 giây giữa requests

async function fetchBooksPage(page) {
  try {
    console.log(`Fetching page ${page}...`);
    const response = await axios.get(
      `${API_BASE}/search.json?q=${encodeURIComponent(QUERY)}&page=${page}&limit=${LIMIT}`
    );
    console.log(`Page ${page}: Found ${response.data.docs?.length || 0} books`);
    return response.data.docs || [];
  } catch (error) {
    console.error(`Lỗi fetch trang ${page}:`, error.message);
    return [];
  }
}

async function getCoverUrl(coverId) {
  if (!coverId) return null;
  return `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`;  // Size medium
}

async function uploadBooks() {
  console.log('Bắt đầu upload 500 sách vào Firestore...');

  let totalBooks = 0;
  let batch = db.batch();  // Thay const thành let để có thể gán lại
  let batchCount = 0;
  const MAX_BATCH = 100;  // Giới hạn batch Firestore

  for (let page = 1; page <= TOTAL_PAGES; page++) {
    const books = await fetchBooksPage(page);

    for (const book of books) {
      // Tạo document data
      const bookData = {
        title: book.title || 'Không có tiêu đề',
        authors: book.author_name || [],
        publishYear: book.first_publish_year || null,
        coverUrl: await getCoverUrl(book.cover_i),
        key: book.key || '',
        description: book.first_sentence || book.subtitle || 'Không có mô tả',  // Mô tả ngắn
        editionCount: book.edition_count || 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),  // Timestamp tự động
      };

      // Tạo ID document từ key (ví dụ: OL123W)
      const docId = book.key.split('/')[2] || `book_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const docRef = db.collection('book_data').doc(docId);

      // Thêm vào batch
      batch.set(docRef, bookData);
      batchCount++;

      totalBooks++;

      // Commit batch nếu đầy
      if (batchCount >= MAX_BATCH) {
        try {
          await batch.commit();
          console.log(`Đã commit batch: ${batchCount} sách (Tổng: ${totalBooks})`);
        } catch (commitError) {
          console.error('Lỗi commit batch:', commitError);
        }
        batchCount = 0;
        batch = db.batch();  // Bây giờ an toàn vì batch là let
      }
// Delay nhỏ giữa sách để tránh overload
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Delay giữa các trang để tránh rate limit API
    console.log(`Hoàn thành trang ${page}/${TOTAL_PAGES}, sách tạm thời: ${totalBooks}`);
    if (page < TOTAL_PAGES) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
  }

  // Commit batch cuối nếu còn
  if (batchCount > 0) {
    try {
      await batch.commit();
      console.log(`Đã commit batch cuối: ${batchCount} sách (Tổng: ${totalBooks})`);
    } catch (commitError) {
      console.error('Lỗi commit batch cuối:', commitError);
    }
  }

  console.log(`\nUpload hoàn tất! Tổng ${totalBooks} sách đã thêm vào collection 'book_data'.`);
  console.log('Kiểm tra trong Firebase Console > Firestore > book_data để xác nhận.');
}

// Chạy script
uploadBooks()
  .then(() => {
    console.log('Script kết thúc thành công.');
    process.exit(0);
  })
  .catch(error => {
    console.error('Lỗi script:', error);
    process.exit(1);
  });