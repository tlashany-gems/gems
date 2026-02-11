
/**
 * ملاحظة أمنية: في التطبيقات الحقيقية، يفضل إجراء هذه العمليات عبر Backend
 * ولكن هنا سنقوم بها مباشرة للتوضيح وتسهيل الربط.
 */

const BOT_TOKEN = '5715894811:AAEn1rgGrt98NbqlkcGPyz0As4mLv_I65qw';

export const telegramService = {
  /**
   * إرسال رسالة من البوت إلى المستخدم
   */
  sendMessage: async (chatId: number | string, text: string) => {
    try {
      const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: 'Markdown'
        })
      });
    } catch (error) {
      console.error('Telegram Bot Error:', error);
    }
  },

  /**
   * إرسال إشعار فوز أو دخول لاعب
   */
  notifyRoomCreated: async (user: any, roomId: string) => {
    if (!user?.id) return;
    const message = `🚀 *تم إنشاء مجلس جديد!*\n\nكود المجلس: \`${roomId}\`\nالمضيف: *${user.first_name || 'بطل'}*\n\nشارك الكود مع أصدقائك وابدأ التحدي!`;
    await telegramService.sendMessage(user.id, message);
  }
};
