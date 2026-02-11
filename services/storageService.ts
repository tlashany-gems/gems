
import { RoomState, Player } from '../types';

// استخدام معرف فريد لضمان استقرار الخدمة
const BUCKET_ID = 'vip_council_live_v2'; 
const BASE_URL = `https://kvdb.io/${BUCKET_ID}/`;

export const storageService = {
  saveRoom: async (room: RoomState): Promise<void> => {
    try {
      // kvdb.io يتطلب PUT لتخزين أو تحديث مفتاح
      const response = await fetch(`${BASE_URL}${room.roomId.toUpperCase()}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...room, serverTime: Date.now() })
      });
      if (!response.ok) throw new Error('Failed to save to cloud');
    } catch (e) {
      console.error("Cloud Storage Error (Save):", e);
    }
  },

  getRoom: async (roomId: string): Promise<RoomState | null> => {
    try {
      const response = await fetch(`${BASE_URL}${roomId.toUpperCase()}`);
      if (!response.ok) return null;
      const data = await response.json();
      return data as RoomState;
    } catch (e) {
      console.error("Cloud Storage Error (Get):", e);
      return null;
    }
  },

  joinRoom: async (roomId: string, player: Player): Promise<RoomState | null> => {
    const room = await storageService.getRoom(roomId);
    if (!room) return null;

    const exists = room.players.find(p => p.id === player.id);
    if (!exists) {
      // التأكد من عدم تجاوز الحد الأقصى للاعبين في العرض
      const updatedRoom = { 
        ...room, 
        players: [...room.players, player],
        serverTime: Date.now()
      };
      await storageService.saveRoom(updatedRoom);
      return updatedRoom;
    }
    return room;
  }
};
