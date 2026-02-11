
import { RoomState } from '../types';

/**
 * في بيئة حقيقية، سيقوم هذا الملف بإجراء طلبات API إلى خادم Node.js
 * يقوم بحفظ ملفات JSON في مجلد data/rooms/.
 * هنا سنقوم بمحاكاة السلوك باستخدام localStorage.
 */

const STORAGE_KEY_PREFIX = 'game_room_';

export const storageService = {
  saveRoom: async (room: RoomState): Promise<void> => {
    // محاكاة تأخير الشبكة
    await new Promise(r => setTimeout(r, 200));
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${room.roomId}`, JSON.stringify(room));
    console.log(`[Server Simulation] Room ${room.roomId} saved to data/rooms/${room.roomId}.json`);
  },

  getRoom: async (roomId: string): Promise<RoomState | null> => {
    await new Promise(r => setTimeout(r, 200));
    const data = localStorage.getItem(`${STORAGE_KEY_PREFIX}${roomId}`);
    return data ? JSON.parse(data) : null;
  },

  listRooms: async (): Promise<string[]> => {
    return Object.keys(localStorage)
      .filter(key => key.startsWith(STORAGE_KEY_PREFIX))
      .map(key => key.replace(STORAGE_KEY_PREFIX, ''));
  }
};
