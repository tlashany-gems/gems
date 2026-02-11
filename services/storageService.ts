
import { RoomState, Player } from '../types';

// استخدام مفتاح فريد للتطبيق لضمان عدم تداخل الغرف مع تطبيقات أخرى
const BUCKET_ID = 'challenge_council_v1_prod'; 
const BASE_URL = `https://kvdb.io/${BUCKET_ID}/`;

export const storageService = {
  // حفظ حالة الغرفة في السحاب
  saveRoom: async (room: RoomState): Promise<void> => {
    try {
      const updatedRoom = { ...room, serverTime: Date.now() };
      await fetch(`${BASE_URL}${room.roomId}`, {
        method: 'POST',
        body: JSON.stringify(updatedRoom)
      });
    } catch (e) {
      console.error("Cloud Save Error:", e);
    }
  },

  // جلب حالة الغرفة من السحاب
  getRoom: async (roomId: string): Promise<RoomState | null> => {
    try {
      const response = await fetch(`${BASE_URL}${roomId.toUpperCase()}`);
      if (!response.ok) return null;
      return await response.json();
    } catch (e) {
      return null;
    }
  },

  // انضمام لاعب جديد للغرفة السحابية
  joinRoom: async (roomId: string, player: Player): Promise<RoomState | null> => {
    const room = await storageService.getRoom(roomId);
    if (!room) return null;

    const exists = room.players.find(p => p.id === player.id);
    if (!exists) {
      room.players.push(player);
      await storageService.saveRoom(room);
    }
    return room;
  }
};
