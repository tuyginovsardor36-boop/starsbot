import { Telegraf, Markup } from "telegraf"
import type { Context } from "telegraf"
import { db } from "../src/lib/firebase"
import { FieldValue } from 'firebase-admin/firestore';

type OrderType = "stars" | "premium" | "gift" | "deposit"
type Order = { id: string; userId: number; username: string; type: OrderType; item: string; amount: number; createdAt: any; status: "pending" | "approved" | "cancelled" }

let botInstance: Telegraf | null = null;
const sessions = new Map<number, { action?: string }>()

const mainKeyboard = () => Markup.keyboard([
  ["💼 Profile", "⭐ Stars sotib olish"], ["🎁 Gift sotib olish", "🏆 Premium sotib olish"],
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
    const userDoc = await db.collection('users').doc(ctx.from.id.toString()).get();
    return userDoc.data()?.isAdmin ?? false;
}

async function isBanned(ctx: Context) {
    if (!ctx.from) return false;
    const userDoc = await db.collection('users').doc(ctx.from.id.toString()).get();
    return userDoc.data()?.isBanned ?? false;
}
const username = (ctx: Context) => ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name ?? "Foydalanuvchi"

export function getBot() {
  if (!botInstance) {
    const token = process.env.TELEGRAM_BOT_TOKEN
    if (!token) throw new Error("TELEGRAM_BOT_TOKEN muhit o'zgaruvchisi topilmadi")
    botInstance = new Telegraf(token)

    botInstance.use(async (ctx, next) => {
        console.log(`[DEBUG] Received message from ${ctx.from?.id}: ${ctx.message && 'text' in ctx.message ? ctx.message.text : 'non-text'}`);
        if (ctx.from) {
            const userRef = db.collection('users').doc(ctx.from.id.toString());
            const userDoc = await userRef.get();
            if (!userDoc.exists) {
                await userRef.set({ 
                    id: ctx.from.id, 
                    username: ctx.from.username || ctx.from.first_name,
                    balance: 0,
                    bonus: 0,
                    activity: 0,
                    totalEarned: 0,
                    totalWithdrawn: 0,
                    referrals: 0,
                    isBanned: false,
                    isAdmin: false
                });
            }
        }
        if (await isBanned(ctx)) return ctx.reply("Sizning akkauntingiz bloklangan.");
        return next()
    })
    
    botInstance.start(async (ctx) => {
        await ctx.reply(`Assalomu alaykum, ${ctx.from?.first_name ?? "foydalanuvchi"}!\n\nStars botga xush kelibsiz. Kerakli bo'limni tanlang:`, mainKeyboard())
    })

    botInstance.hears("💼 Profile", async (ctx) => {
      console.log(`[DEBUG] Profile command received from ${ctx.from?.id}`);
      try {
        const user = ctx.from;
        if (!user) return;
        
        console.log(`[DEBUG] Fetching user ${user.id} from DB`);
        const userDoc = await db.collection('users').doc(user.id.toString()).get();
        const dbUser = userDoc.data();
        
        if (!dbUser) {
            console.log(`[DEBUG] User ${user.id} not found in DB`);
            return ctx.reply("Siz bazada topilmadingiz.");
        }

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
        
        console.log(`[DEBUG] Replying to profile command`);
        return await ctx.replyWithMarkdown(profileText, mainKeyboard());
      } catch (e) {
        console.error(`[ERROR] Profile handler error:`, e);
        return ctx.reply("Profilni yuklashda xatolik yuz berdi.");
      }
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
    botInstance.hears("🛠 Admin panel", async (ctx) => await isAdmin(ctx) ? ctx.reply("🛠 Admin panel:", adminKeyboard()) : ctx.reply("Sizda admin huquqi mavjud emas.", mainKeyboard()));
    botInstance.hears("🔙 Orqaga", (ctx) => ctx.reply("Asosiy menyu:", mainKeyboard()));

    botInstance.hears("📊 Statistika", async (ctx) => {
        if (!await isAdmin(ctx)) return;
        const usersSnapshot = await db.collection('users').count().get();
        const pendingOrders = await db.collection('orders').where('status', '==', 'pending').count().get();
        const approvedOrders = await db.collection('orders').where('status', '==', 'approved').count().get();
        return ctx.reply(`📊 Statistika\n\n👥 Foydalanuvchilar: ${usersSnapshot.data().count}\n⏳ Pending: ${pendingOrders.data().count}\n✅ Tasdiqlangan: ${approvedOrders.data().count}`, adminKeyboard());
    });
    botInstance.hears("📥 Pending tranzaksiyalar", async (ctx) => { 
        if (!await isAdmin(ctx)) return; 
        const pending = await db.collection('orders').where('status', '==', 'pending').get();
        return ctx.reply(pending.size ? pending.docs.map((o) => { const d = o.data(); return `#${d.id} — ${d.username} — ${d.item} — ${money(d.amount ?? 0)}`}).join("\n") : "📥 Kutilayotgan tranzaksiyalar mavjud emas.", adminKeyboard()) 
    });
    botInstance.hears("📜 Tarix", async (ctx) => { 
        if (!await isAdmin(ctx)) return; 
        const list = await db.collection('orders').orderBy('createdAt', 'desc').limit(15).get();
        return ctx.reply(list.size ? list.docs.map((o) => { const d = o.data(); return `#${d.id} ${d.status === "approved" ? "✅" : d.status === "cancelled" ? "❌" : "⏳"} ${d.username} — ${d.item}`}).join("\n") : "📜 Tarix bo'sh.", adminKeyboard()) 
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

    botInstance.on("text", async (ctx) => {
      const session = sessions.get(ctx.from.id);
      if (!session) return;
      
      const text = ctx.message.text;

      // Broadcast Logic
      if (session.action === "broadcast") {
        const allUsers = await db.collection('users').get();
        for (const userDoc of allUsers.docs) {
          await botInstance!.telegram.sendMessage(userDoc.id, text).catch(() => {});
        }
        ctx.reply("✅ Xabar barchaga yuborildi.");
        sessions.delete(ctx.from.id);
        return ctx.reply("Boshqaruv menyusi:", adminKeyboard());
      }

      // Add Admin Logic
      if (session.action === "add_admin") {
        const userId = text.replace(/[^0-9]/g, "");
        if (userId) {
          await db.collection('users').doc(userId).update({isAdmin: true});
          ctx.reply(`✅ Foydalanuvchi ${userId} admin qilindi.`);
        }
        sessions.delete(ctx.from.id);
        return ctx.reply("Boshqaruv menyusi:", adminKeyboard());
      }

      // Ban/Unban Logic
      if (session.action === "ban_user" || session.action === "unban_user") {
        const userId = Number(text.replace(/[^0-9]/g, ""));
        if (isNaN(userId)) return ctx.reply("Iltimos, to'g'ri ID kiriting.");
        
        await db.collection('users').doc(userId.toString()).update({isBanned: session.action === "ban_user"});
        ctx.reply(`✅ Foydalanuvchi ${userId} ${session.action === "ban_user" ? "ban" : "unban"} qilindi.`);
        
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
