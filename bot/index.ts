import { Telegraf, Markup } from "telegraf"
import type { Context } from "telegraf"

type OrderType = "stars" | "premium" | "gift" | "deposit"
type Order = { id: string; userId: number; username: string; type: OrderType; item: string; amount: number; createdAt: Date; status: "pending" | "approved" | "cancelled" }

let botInstance: Telegraf | null = null;
const adminIds = new Set((process.env.TELEGRAM_ADMIN_IDS ?? "").split(",").map((id) => id.trim()).filter(Boolean))
const orders = new Map<string, Order>()
const balances = new Map<number, number>()
const referrals = new Map<number, number>()
const bannedUsers = new Set<number>()
const userIds = new Set<number>()
const sessions = new Map<number, { action?: string }>()
let orderSequence = 1000

const mainKeyboard = () => Markup.keyboard([
  ["💼 Profile", "⭐ Stars sotib olish"], ["🎁 Gift sotib olish", "🏆 Premium sotib olish"],
  ["💰 Hisob to'ldirish", "💳 Hisobim"], ["🔗 Referral", "🆘 Support"], ["🛠 Admin panel"], ["❌ Bekor qilish"],
]).resize()
const adminKeyboard = () => Markup.keyboard([
  ["📊 Statistika", "📥 Pending tranzaksiyalar"], ["➕ Admin qo'shish", "➖ Admin olish"],
  ["📣 Post yuborish", "✉️ Xabar yuborish foydalanuvchiga"], ["🚫 Ban user", "♻️ Unban user"],
  ["🎁 Manage gifts", "📜 Tarix"], ["🔙 Orqaga"],
]).resize()
const cancelKeyboard = () => Markup.keyboard([["❌ Bekor qilish"]]).resize()
const money = (value: number) => `${value.toLocaleString("uz-UZ")} so'm`
const isAdmin = (ctx: Context) => Boolean(ctx.from && adminIds.has(String(ctx.from.id)))
const isBanned = (ctx: Context) => Boolean(ctx.from && bannedUsers.has(ctx.from.id))
const username = (ctx: Context) => ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name ?? "Foydalanuvchi"
const balance = (id: number) => balances.get(id) ?? 0

function orderButtons(order: Order) {
  return Markup.inlineKeyboard([[Markup.button.callback("✅ Tasdiqlash", `approve:${order.id}`), Markup.button.callback("❌ Bekor qilish", `cancel:${order.id}`)]])
}

export function getBot() {
  if (!botInstance) {
    const token = process.env.TELEGRAM_BOT_TOKEN
    if (!token) throw new Error("TELEGRAM_BOT_TOKEN muhit o'zgaruvchisi topilmadi")
    botInstance = new Telegraf(token)

    async function notifyAdmins(order: Order) {
      const text = `🔔 Yangi buyurtma #${order.id}\n\n👤 ${order.username}\n🆔 ${order.userId}\n📦 ${order.item}\n💵 ${money(order.amount)}\n\nHolat: ⏳ Kutilmoqda`
      for (const admin of adminIds) await botInstance!.telegram.sendMessage(admin, text, orderButtons(order)).catch(() => undefined)
    }
    async function createOrder(ctx: Context, type: OrderType, item: string, amount: number) {
      if (!ctx.from) return
      const order: Order = { id: String(++orderSequence), userId: ctx.from.id, username: username(ctx), type, item, amount, createdAt: new Date(), status: "pending" }
      orders.set(order.id, order); await notifyAdmins(order)
      sessions.delete(ctx.from.id)
      await ctx.reply(`✅ Buyurtmangiz qabul qilindi.\n\n📦 ${item}\n💵 ${money(amount)}\n🧾 Buyurtma: #${order.id}\n\nAdmin tasdiqlashini kuting.`, mainKeyboard())
    }

    botInstance.use(async (ctx, next) => { if (ctx.from) userIds.add(ctx.from.id); if (isBanned(ctx)) return ctx.reply("Sizning akkauntingiz bloklangan."); return next() })
    botInstance.start(async (ctx) => { const ref = ctx.startPayload; if (ref?.startsWith("REF")) referrals.set(Number(ref.slice(3)), (referrals.get(Number(ref.slice(3))) ?? 0) + 1); await ctx.reply(`Assalomu alaykum, ${ctx.from?.first_name ?? "foydalanuvchi"}!\n\nStars botga xush kelibsiz. Kerakli bo'limni tanlang:`, mainKeyboard()) })

    botInstance.hears("💼 Profile", (ctx) => {
      const user = ctx.from;
      const profileText = `💼 **SHAXSIY PROFIL**

👤 Ism: ${user?.first_name ?? "User"}
🔗 Username: ${username(ctx)}
🆔 Telegram ID: ${user?.id}

💰 Balans: ${money(balance(user?.id ?? 0))}
🎁 Takliflar: ${referrals.get(user?.id ?? 0) ?? 0} ta
💎 Bonuslar: ${money(0)}
📈 Faollik: 0 ball

💳 Jami daromad: ${money(0)}
💸 Jami yechilgan: ${money(0)}
📊 Tranzaksiyalar: 0 ta

🟢 Holat: Faol
🛡️ Akkaunt: Tasdiqlangan

⚡️ Profilingiz orqali hisobingizni boshqaring.`;
      return ctx.replyWithMarkdown(profileText, mainKeyboard());
    });
    
    // Admin handlers
    botInstance.hears("📣 Post yuborish", (ctx) => {
      if (!isAdmin(ctx)) return;
      sessions.set(ctx.from!.id, { action: "broadcast" });
      return ctx.reply("Barcha foydalanuvchilarga yubormoqchi bo'lgan xabaringizni yozing:", cancelKeyboard());
    });
    
    botInstance.hears("➕ Admin qo'shish", (ctx) => {
      if (!isAdmin(ctx)) return;
      sessions.set(ctx.from!.id, { action: "add_admin" });
      return ctx.reply("Yangi admin qilmoqchi bo'lgan foydalanuvchi ID'sini yozing:", cancelKeyboard());
    });

    botInstance.on("text", async (ctx) => {
      const session = sessions.get(ctx.from.id);
      if (!session) return;
      
      const text = ctx.message.text;

      // Broadcast Logic
      if (session.action === "broadcast") {
        for (const userId of userIds) {
          await botInstance!.telegram.sendMessage(userId, text).catch(() => {});
        }
        ctx.reply("✅ Xabar barchaga yuborildi.");
        sessions.delete(ctx.from.id);
        return ctx.reply("Boshqaruv menyusi:", adminKeyboard());
      }

      // Add Admin Logic
      if (session.action === "add_admin") {
        const userId = text.replace(/[^0-9]/g, "");
        if (userId) {
          adminIds.add(userId);
          ctx.reply(`✅ Foydalanuvchi ${userId} admin qilindi.`);
        }
        sessions.delete(ctx.from.id);
        return ctx.reply("Boshqaruv menyusi:", adminKeyboard());
      }

      // Ban/Unban Logic
      if (session.action === "ban_user" || session.action === "unban_user") {
        const userId = Number(text.replace(/[^0-9]/g, ""));
        if (isNaN(userId)) return ctx.reply("Iltimos, to'g'ri ID kiriting.");
        
        if (session.action === "ban_user") {
          bannedUsers.add(userId);
          ctx.reply(`✅ Foydalanuvchi ${userId} ban qilindi.`);
        } else {
          bannedUsers.delete(userId);
          ctx.reply(`✅ Foydalanuvchi ${userId} unban qilindi.`);
        }
        sessions.delete(ctx.from.id);
        return ctx.reply("Boshqaruv menyusi:", adminKeyboard());
      }
      
      // Deposit Logic
      const amount = Number(text.replace(/[^0-9]/g, ""));
      if (session.action === "deposit" && amount > 0) await createOrder(ctx, "deposit", `Balans to'ldirish (${money(amount)})`, amount);
      else await ctx.reply("Iltimos, musbat summa kiriting.", cancelKeyboard()) 
    });
    botInstance.on("callback_query", async (ctx) => { await ctx.answerCbQuery(); const data = "data" in ctx.callbackQuery ? ctx.callbackQuery.data : ""; if (data === "back") return ctx.reply("Asosiy menyu:", mainKeyboard()); const [action, value, rawAmount] = data.split(":"); if (action === "stars" || action === "premium" || action === "gift") return createOrder(ctx, action, `${action === "stars" ? "⭐ " : action === "premium" ? "🏆 Premium " : "🎁 "}${value}`, Number(rawAmount)); if ((action === "approve" || action === "cancel") && isAdmin(ctx)) { const order = orders.get(value); if (!order || order.status !== "pending") return ctx.reply("Bu buyurtma allaqachon ko'rib chiqilgan."); order.status = action === "approve" ? "approved" : "cancelled"; if (action === "approve" && order.type === "deposit") balances.set(order.userId, balance(order.userId) + order.amount); await botInstance!.telegram.sendMessage(order.userId, action === "approve" ? `✅ Buyurtma #${order.id} tasdiqlandi.\nBalansingiz: ${money(balance(order.userId))}` : `❌ Buyurtma #${order.id} bekor qilindi.`); return ctx.editMessageText(`#${order.id} — ${action === "approve" ? "✅ TASDIQLANDI" : "❌ BEKOR QILINDI"}`) } })
    botInstance.catch((error) => console.error("[v0] Telegram bot xatosi:", error))
  }
  return botInstance
}

if (process.env.VERCEL !== "1" && process.env.TELEGRAM_WEBHOOK_MODE !== "true") {
  getBot().launch().then(() => console.log("[v0] Stars bot polling orqali ishga tushdi"))
}
