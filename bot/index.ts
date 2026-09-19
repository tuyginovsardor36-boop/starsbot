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
  ["💰 Hisob to'ldirish", "💳 Hisobim"], ["🔗 Referral", "🆘 Support"], ["🛠 Admin panel"], ["❌ Bekor qilish"],
]).resize()

const adminKeyboard = () => Markup.keyboard([
  ["📊 Statistika", "📥 Pending tranzaksiyalar", "📜 Tarix"], 
  ["➕ Admin qo'shish", "➖ Admin olish", "🚫 Ban user"],
  ["📣 Post yuborish", "✉️ Xabar yuborish", "♻️ Unban user"],
  ["🎁 Manage gifts", "🛠 Config", "🔙 Orqaga"],
]).resize()

const cancelKeyboard = () => Markup.keyboard([["❌ Bekor qilish"]]).resize()
const money = (value: number) => `${value.toLocaleString("uz-UZ")} so'm`

async function isAdmin(ctx: Context) {
    if (!ctx.from) return false;
    const user = await db.select().from(users).where(eq(users.id, ctx.from.id)).then(res => res[0]);
    return user?.isAdmin ?? false;
}

async function isBanned(ctx: Context) {
    if (!ctx.from) return false;
    const user = await db.select().from(users).where(eq(users.id, ctx.from.id)).then(res => res[0]);
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
            await db.insert(users).values({ id: ctx.from.id, username: ctx.from.username || ctx.from.first_name }).onConflictDoNothing()
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
      const dbUser = await db.select().from(users).where(eq(users.id, user.id)).then(res => res[0]);
      
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
    
    botInstance.hears("🔗 Referral", (ctx) => ctx.reply(`🔗 Referral\n\nSizning kodingiz: REF${ctx.from.id}\nHavola: https://t.me/${botInstance!.botInfo?.username}?start=REF${ctx.from.id}\n\nTakliflar: ...`, mainKeyboard()));
    botInstance.hears("🆘 Support", (ctx) => ctx.reply("🆘 Support\n\nOperator: @support_username\nMurojaatingizni shu yerga yozing.", mainKeyboard()));
    botInstance.hears("❌ Bekor qilish", (ctx) => { if (ctx.from) sessions.delete(ctx.from.id); return ctx.reply("Amal bekor qilindi.", mainKeyboard()) });
    botInstance.hears("🛠 Admin panel", async (ctx) => await isAdmin(ctx) ? ctx.reply("🛠 Admin panel:", adminKeyboard()) : ctx.reply("Sizda admin huquqi mavjud emas.", mainKeyboard()));
    botInstance.hears("🔙 Orqaga", (ctx) => ctx.reply("Asosiy menyu:", mainKeyboard()));

    botInstance.hears("📊 Statistika", async (ctx) => {
        if (!await isAdmin(ctx)) return;
        const totalUsers = await db.select({count: count()}).from(users).then(res => res[0].count);
        const pendingOrders = await db.select({count: count()}).from(orders).where(eq(orders.status, 'pending')).then(res => res[0].count);
        const approvedOrders = await db.select({count: count()}).from(orders).where(eq(orders.status, 'approved')).then(res => res[0].count);
        return ctx.reply(`📊 Statistika\n\n👥 Foydalanuvchilar: ${totalUsers}\n⏳ Pending: ${pendingOrders}\n✅ Tasdiqlangan: ${approvedOrders}`, adminKeyboard());
    });
    botInstance.hears("📥 Pending tranzaksiyalar", async (ctx) => { 
        if (!await isAdmin(ctx)) return; 
        const pending = await db.select().from(orders).where(eq(orders.status, 'pending'));
        return ctx.reply(pending.length ? pending.map((o) => `#${o.id} — ${o.username} — ${o.item} — ${money(o.amount ?? 0)}`).join("\n") : "📥 Kutilayotgan tranzaksiyalar mavjud emas.", adminKeyboard()) 
    });
    botInstance.hears("📜 Tarix", async (ctx) => { 
        if (!await isAdmin(ctx)) return; 
        const list = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(15);
        return ctx.reply(list.length ? list.map((o) => `#${o.id} ${o.status === "approved" ? "✅" : o.status === "cancelled" ? "❌" : "⏳"} ${o.username} — ${o.item}`).join("\n") : "📜 Tarix bo'sh.", adminKeyboard()) 
    });
    
    // Admin handlers
    botInstance.hears("📣 Post yuborish", async (ctx) => {
      if (!await isAdmin(ctx)) return;
      sessions.set(ctx.from!.id, { action: "broadcast" });
      return ctx.reply("Barcha foydalanuvchilarga yubormoqchi bo'lgan xabaringizni yozing:", cancelKeyboard());
    });
    botInstance.hears("➕ Admin qo'shish", async (ctx) => {
      if (!await isAdmin(ctx)) return;
      sessions.set(ctx.from!.id, { action: "add_admin" });
      return ctx.reply("Yangi admin qilmoqchi bo'lgan foydalanuvchi ID'sini yozing:", cancelKeyboard());
    });

    botInstance.on('text', async (ctx) => {
      const session = sessions.get(ctx.from.id);
      if (!session) return;
      const text = ctx.message.text;

      // Broadcast Logic
      if (session.action === "broadcast") {
        const allUsers = await db.select({id: users.id}).from(users);
        for (const user of allUsers) {
          await botInstance!.telegram.sendMessage(user.id.toString(), text).catch(() => {});
        }
        ctx.reply("✅ Xabar barchaga yuborildi.");
        sessions.delete(ctx.from.id);
        return ctx.reply("Boshqaruv menyusi:", adminKeyboard());
      }

      // Add Admin Logic
      if (session.action === "add_admin") {
        const userId = Number(text.replace(/[^0-9]/g, ""));
        if (userId) {
          await db.update(users).set({isAdmin: true}).where(eq(users.id, userId));
          ctx.reply(`✅ Foydalanuvchi ${userId} admin qilindi.`);
        }
        sessions.delete(ctx.from.id);
        return ctx.reply("Boshqaruv menyusi:", adminKeyboard());
      }

      // Ban/Unban Logic
      if (session.action === "ban_user" || session.action === "unban_user") {
        const userId = Number(text.replace(/[^0-9]/g, ""));
        if (isNaN(userId)) return ctx.reply("Iltimos, to'g'ri ID kiriting.");
        
        await db.update(users).set({isBanned: session.action === "ban_user"}).where(eq(users.id, userId));
        ctx.reply(`✅ Foydalanuvchi ${userId} ${session.action === "ban_user" ? "ban" : "unban"} qilindi.`);
        
        sessions.delete(ctx.from.id);
        return ctx.reply("Boshqaruv menyusi:", adminKeyboard());
      }
    });

    return botInstance
}
