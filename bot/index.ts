import { Telegraf, Markup } from "telegraf"
import type { Context } from "telegraf"
import { db } from "../src/db"
import { users, orders } from "../src/db/schema"
import { eq } from "drizzle-orm"

type OrderType = "stars" | "premium" | "gift" | "deposit"
type Order = typeof orders.$inferSelect

let botInstance: Telegraf | null = null;
const adminIds = new Set((process.env.TELEGRAM_ADMIN_IDS ?? "").split(",").map((id) => id.trim()).filter(Boolean))
const bannedUsers = new Set<number>()
const sessions = new Map<number, { action?: string }>()

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

export function getBot() {
  if (!botInstance) {
    const token = process.env.TELEGRAM_BOT_TOKEN
    if (!token) throw new Error("TELEGRAM_BOT_TOKEN muhit o'zgaruvchisi topilmadi")
    botInstance = new Telegraf(token)

    botInstance.use(async (ctx, next) => {
        if (ctx.from) {
            // Ensure user exists in DB
            await db.insert(users).values({ id: ctx.from.id, username: ctx.from.username || ctx.from.first_name }).onConflictDoNothing()
        }
        if (isBanned(ctx)) return ctx.reply("Sizning akkauntingiz bloklangan.");
        return next()
    })
    
    botInstance.start(async (ctx) => {
        // ... (existing logic)
        await ctx.reply(`Assalomu alaykum, ${ctx.from?.first_name ?? "foydalanuvchi"}!\n\nStars botga xush kelibsiz. Kerakli bo'limni tanlang:`, mainKeyboard())
    })

    botInstance.hears("💼 Profile", async (ctx) => {
      const user = ctx.from;
      if (!user) return;
      const dbUser = await db.select().from(users).where(eq(users.id, user.id)).then(res => res[0]);
      
      const profileText = `💼 **SHAXSIY PROFIL**

👤 Ism: ${user?.first_name ?? "User"}
🔗 Username: ${username(ctx)}
🆔 Telegram ID: ${user?.id}

💰 Balans: ${money(dbUser?.balance ?? 0)}
🎁 Takliflar: ${dbUser?.referrals ?? 0} ta
💎 Bonuslar: ${money(dbUser?.bonus ?? 0)}
📈 Faollik: ${dbUser?.activity ?? 0} ball

💳 Jami daromad: ${money(dbUser?.totalEarned ?? 0)}
💸 Jami yechilgan: ${money(dbUser?.totalWithdrawn ?? 0)}
📊 Tranzaksiyalar: 0 ta

🟢 Holat: ${dbUser?.isBanned ? "🔴 Bloklangan" : "🟢 Faol"}
🛡️ Akkaunt: Tasdiqlangan

⚡️ Profilingiz orqali hisobingizni boshqaring.`;
      return ctx.replyWithMarkdown(profileText, mainKeyboard());
    });
    
    // ... rest of the handlers ...
    botInstance.hears("⭐ Stars sotib olish", (ctx) => ctx.reply("⭐ Stars sotib olish\n\nPaketni tanlang:", Markup.inlineKeyboard([[Markup.button.callback("⭐ 50 Stars — 10 000 so'm", "stars:50:10000")], [Markup.button.callback("⭐ 100 Stars — 19 000 so'm", "stars:100:19000")], [Markup.button.callback("⭐ 500 Stars — 90 000 so'm", "stars:500:90000")], [Markup.button.callback("🔙 Orqaga", "back")]])));
    botInstance.hears("🎁 Gift sotib olish", (ctx) => ctx.reply("🎁 Gift sotib olish\n\nGiftni tanlang:", Markup.inlineKeyboard([[Markup.button.callback("🎁 Heart — 15 000 so'm", "gift:Heart:15000")], [Markup.button.callback("🎁 Rose — 25 000 so'm", "gift:Rose:25000")], [Markup.button.callback("🎁 Premium Gift — 50 000 so'm", "gift:Premium Gift:50000")], [Markup.button.callback("🔙 Orqaga", "back")]])));
    botInstance.hears("🏆 Premium sotib olish", (ctx) => ctx.reply("🏆 Premium sotib olish\n\nMuddatni tanlang:", Markup.inlineKeyboard([[Markup.button.callback("1 oy — 45 000 so'm", "premium:1 oy:45000")], [Markup.button.callback("3 oy — 110 000 so'm", "premium:3 oy:110000")], [Markup.button.callback("12 oy — 350 000 so'm", "premium:12 oy:350000")], [Markup.button.callback("🔙 Orqaga", "back")]])));
    botInstance.hears("💰 Hisob to'ldirish", (ctx) => { sessions.set(ctx.from.id, { action: "deposit" }); return ctx.reply("💰 Hisob to'ldirish\n\nTo'lov summasini so'mda yozing. Masalan: 50000", cancelKeyboard()) });
    botInstance.hears("💳 Hisobim", (ctx) => ctx.reply(`💳 Hisobingiz\n\n💰 Balans: ${money(balance(ctx.from.id))}`, mainKeyboard()));
    botInstance.hears("🔗 Referral", (ctx) => ctx.reply(`🔗 Referral\n\nSizning kodingiz: REF${ctx.from.id}\nHavola: https://t.me/${ctx.botInfo.username}?start=REF${ctx.from.id}\n\nTakliflar: ${referrals.get(ctx.from.id) ?? 0}`, mainKeyboard()));
    botInstance.hears("🆘 Support", (ctx) => ctx.reply("🆘 Support\n\nOperator: @support_username\nMurojaatingizni shu yerga yozing.", mainKeyboard()));
    botInstance.hears("❌ Bekor qilish", (ctx) => { if (ctx.from) sessions.delete(ctx.from.id); return ctx.reply("Amal bekor qilindi.", mainKeyboard()) });
    botInstance.hears("🛠 Admin panel", (ctx) => isAdmin(ctx) ? ctx.reply("🛠 Admin panel:", adminKeyboard()) : ctx.reply("Sizda admin huquqi mavjud emas.", mainKeyboard()));
    botInstance.hears("🔙 Orqaga", (ctx) => ctx.reply("Asosiy menyu:", mainKeyboard()));

    botInstance.hears("📊 Statistika", (ctx) => isAdmin(ctx) ? ctx.reply(`📊 Statistika\n\n👥 Foydalanuvchilar: ${userIds.size}\n⏳ Pending: ${[...orders.values()].filter((o) => o.status === "pending").length}\n✅ Tasdiqlangan: ${[...orders.values()].filter((o) => o.status === "approved").length}`, adminKeyboard()) : undefined);
    botInstance.hears("📥 Pending tranzaksiyalar", (ctx) => { if (!isAdmin(ctx)) return; const pending = [...orders.values()].filter((o) => o.status === "pending"); return ctx.reply(pending.length ? pending.map((o) => `#${o.id} — ${o.username} — ${o.item} — ${money(o.amount)}`).join("\n") : "📥 Kutilayotgan tranzaksiyalar mavjud emas.", adminKeyboard()) });
    botInstance.hears("📜 Tarix", (ctx) => { if (!isAdmin(ctx)) return; const list = [...orders.values()].slice(-15).reverse(); return ctx.reply(list.length ? list.map((o) => `#${o.id} ${o.status === "approved" ? "✅" : o.status === "cancelled" ? "❌" : "⏳"} ${o.username} — ${o.item}`).join("\n") : "📜 Tarix bo'sh.", adminKeyboard()) });
    
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

if (process.env.VERCEL !== "1" && process.env.TELEGRAM_WEBHOOK_MODE !== "true" && process.env.TELEGRAM_BOT_TOKEN) {
  getBot().launch().then(() => console.log("[v0] Stars bot polling orqali ishga tushdi"))
}
