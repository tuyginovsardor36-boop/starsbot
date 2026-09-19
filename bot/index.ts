import { Telegraf, Markup } from "telegraf"
import type { Context } from "telegraf"
import { db } from "../src/db"
import { users, orders } from "../src/db/schema"
import { eq, desc, count } from "drizzle-orm"

type OrderType = "stars" | "premium" | "gift" | "deposit"
type Order = typeof orders.$inferSelect

let botInstance: Telegraf | null = null;
const sessions = new Map<number, { action?: string }>()

const mainKeyboard = () => Markup.keyboard([
  ["💼 Profile", "⭐ Stars sotib olish"], 
  ["🎁 Gift sotib olish", "🏆 Premium sotib olish"],
  ["💰 Hisob to'ldirish", "💳 Hisobim"], 
  ["🔗 Referral", "🆘 Support"], 
  ["🛠 Admin panel"],
]).resize()

const adminKeyboard = () => Markup.keyboard([
  ["📊 Statistika", "📥 Pending tranzaksiyalar", "📜 Tarix"], 
  ["➕ Admin qo'shish", "➖ Admin olish", "🚫 Ban user"],
  ["📣 Post yuborish", "✉️ Xabar yuborish", "♻️ Unban user"],
  ["🔙 Asosiy menyu"],
]).resize()

const cancelKeyboard = () => Markup.keyboard([["❌ Bekor qilish"]]).resize()
const money = (value: number) => `${value.toLocaleString("uz-UZ")} so'm`

async function isAdmin(ctx: Context) {
    if (!ctx.from) return false;
    const user = await db.select().from(users).where(eq(users.id, ctx.from.id.toString())).then(res => res[0]);
    return user?.isAdmin ?? false;
}

async function isBanned(ctx: Context) {
    if (!ctx.from) return false;
    const user = await db.select().from(users).where(eq(users.id, ctx.from.id.toString())).then(res => res[0]);
    return user?.isBanned ?? false;
}
const username = (ctx: Context) => ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name ?? "Foydalanuvchi"

export function getBot() {
    if (botInstance) return botInstance
    const token = process.env.TELEGRAM_BOT_TOKEN
    if (!token) throw new Error("TELEGRAM_BOT_TOKEN is missing")
    botInstance = new Telegraf(token)

    botInstance.use(async (ctx, next) => {
        if (ctx.from) {
            await db.insert(users).values({ id: ctx.from.id.toString(), username: ctx.from.username || ctx.from.first_name }).onConflictDoNothing()
        }
        if (await isBanned(ctx)) return ctx.reply("Sizning akkauntingiz bloklangan.");
        return next()
    })
    
    botInstance.start((ctx) => {
        ctx.reply(`Assalomu alaykum, ${ctx.from?.first_name ?? "foydalanuvchi"}!\n\nStars botga xush kelibsiz. Kerakli bo'limni tanlang:`, mainKeyboard())
    })

    botInstance.hears("💼 Profile", async (ctx) => {
      const user = ctx.from;
      if (!user) return;
      const dbUser = await db.select().from(users).where(eq(users.id, user.id.toString())).then(res => res[0]);
      
      if (!dbUser) return ctx.reply("Siz bazada topilmadingiz.");

      const profileText = `💼 **SHAXSIY PROFIL**

 👤 Ism: ${user?.first_name ?? "User"}
 🔗 Username: ${username(ctx)}
 🆔 ID: ${user.id}
 
 💰 Balans: ${money(dbUser.balance ?? 0)}
 🎁 Bonus: ${money(dbUser.bonus ?? 0)}
 ⚡️ Faollik: ${dbUser.activity ?? 0}
 
 💎 Umumiy ishlangan: ${money(dbUser.totalEarned ?? 0)}
 💸 Umumiy yechilgan: ${money(dbUser.totalWithdrawn ?? 0)}
 👥 Referral: ${dbUser.referrals ?? 0}
 
 🛡️ Akkaunt: Tasdiqlangan
 
 ⚡️ Profilingiz orqali hisobingizni boshqaring.`;
      return ctx.replyWithMarkdown(profileText, mainKeyboard());
    });
    
    botInstance.hears("⭐ Stars sotib olish", (ctx) => ctx.reply("Paketni tanlang:", mainKeyboard()));
    botInstance.hears("🎁 Gift sotib olish", (ctx) => ctx.reply("Giftni tanlang:", mainKeyboard()));
    botInstance.hears("🏆 Premium sotib olish", (ctx) => ctx.reply("Muddatni tanlang:", mainKeyboard()));
    botInstance.hears("💰 Hisob to'ldirish", (ctx) => ctx.reply("To'lov summasini so'mda yozing. Masalan: 50000", cancelKeyboard()));
    botInstance.hears("💳 Hisobim", async (ctx) => {
        const dbUser = await db.select().from(users).where(eq(users.id, ctx.from.id.toString())).then(res => res[0]);
        ctx.reply(`💳 Hisobingiz: ${money(dbUser?.balance ?? 0)}`, mainKeyboard());
    });
    
    botInstance.hears("🔗 Referral", (ctx) => ctx.reply(`🔗 Referral\n\nSizning kodingiz: REF${ctx.from.id}\nHavola: https://t.me/${botInstance!.botInfo?.username}?start=REF${ctx.from.id}`, mainKeyboard()));
    botInstance.hears("🆘 Support", (ctx) => ctx.reply("🆘 Support\n\nOperator: @support_username\nMurojaatingizni shu yerga yozing.", mainKeyboard()));
    botInstance.hears("❌ Bekor qilish", (ctx) => { if (ctx.from) sessions.delete(ctx.from.id); return ctx.reply("Amal bekor qilindi.", mainKeyboard()) });
    botInstance.hears("🛠 Admin panel", async (ctx) => await isAdmin(ctx) ? ctx.reply("🛠 Admin panel:", adminKeyboard()) : ctx.reply("Sizda admin huquqi mavjud emas.", mainKeyboard()));
    botInstance.hears("🔙 Asosiy menyu", (ctx) => ctx.reply("Asosiy menyu:", mainKeyboard()));

    // ... Admin handlers and text handler ...
    return botInstance
}
