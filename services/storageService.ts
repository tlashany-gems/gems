
import { RoomState, Player } from '../types';

const STORAGE_KEY_PREFIX = 'council_room_';

export const storageService = {
  // حفظ حالة الغرفة (يستدعيه المضيف أو عند التصويت)
  saveRoom: async (room: RoomState): Promise<void> => {
    const updatedRoom = { ...room, serverTime: Date.now() };
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${room.roomId}`, JSON.stringify(updatedRoom));
  },

  // جلب حالة الغرفة (يستدعيه جميع اللاعبين للمزامنة)
  getRoom: async (roomId: string): Promise<RoomState | null> => {
    const data = localStorage.getItem(`${STORAGE_KEY_PREFIX}${roomId}`);
    return data ? JSON.parse(data) : null;
  },

  // انضمام لاعب جديد للغرفة
  joinRoom: async (roomId: string, player: Player): Promise<RoomState | null> => {
    const room = await storageService.getRoom(roomId);
    if (!room) return null;

    // منع التكرار
    const exists = room.players.find(p => p.id === player.id);
    if (!exists) {
      room.players.push(player);
      await storageService.saveRoom(room);
    }
    return room;
  }
};
