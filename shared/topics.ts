// Danh sách chủ đề (dùng chung client + server). Từ của mỗi chủ đề nằm ở server/src/words/<id>.ts
export const TOPICS = [
  { id: 'animals', name: 'Động vật', emoji: '🐾' },
  { id: 'fruits', name: 'Trái cây & rau củ', emoji: '🍎' },
  { id: 'food', name: 'Món ăn & đồ uống', emoji: '🍜' },
  { id: 'home', name: 'Đồ vật trong nhà', emoji: '🏠' },
  { id: 'tech', name: 'Đồ điện tử & công nghệ', emoji: '💻' },
  { id: 'fashion', name: 'Quần áo & phụ kiện', emoji: '👕' },
  { id: 'office', name: 'Học tập & dụng cụ', emoji: '✏️' },
  { id: 'vehicles', name: 'Phương tiện & giao thông', emoji: '🚗' },
  { id: 'nature', name: 'Thiên nhiên & cây cối', emoji: '🌳' },
  { id: 'space', name: 'Vũ trụ & khoa học', emoji: '🔭' },
  { id: 'places', name: 'Địa điểm & công trình', emoji: '🏛️' },
  { id: 'jobs', name: 'Nghề nghiệp & con người', emoji: '👩‍⚕️' },
  { id: 'fantasy', name: 'Phiêu lưu & cổ tích', emoji: '🧙' },
  { id: 'sports', name: 'Thể thao', emoji: '🏅' },
  { id: 'games', name: 'Đồ chơi & trò chơi', emoji: '🧸' },
  { id: 'music', name: 'Âm nhạc & nghệ thuật', emoji: '🎨' },
  { id: 'body', name: 'Cơ thể & hành động', emoji: '💪' },
  { id: 'vietnam', name: 'Lễ hội & Việt Nam', emoji: '🏮' },
] as const;

export type TopicId = (typeof TOPICS)[number]['id'];

export const TOPIC_IDS: readonly string[] = TOPICS.map((t) => t.id);

/** Chủ đề của từ tùy chỉnh do chủ phòng thêm */
export const CUSTOM_TOPIC = { id: 'custom', name: 'Tùy chỉnh', emoji: '✍️' } as const;

export function topicInfo(id: string | null | undefined) {
  if (id === CUSTOM_TOPIC.id) return CUSTOM_TOPIC;
  return TOPICS.find((t) => t.id === id) ?? null;
}
