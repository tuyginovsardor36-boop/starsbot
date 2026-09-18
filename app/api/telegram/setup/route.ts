import { NextResponse } from "next/server"
import { getBot } from "../../../../bot"

export const runtime = "nodejs"

const domain = "https://starsbot-indol.vercel.app"

export async function GET() {
  try {
    const webhook = `${domain}/api/telegram/webhook`
    const bot = getBot()
    await bot.telegram.setWebhook(webhook)
    const info = await bot.telegram.getWebhookInfo()
    return NextResponse.json({ ok: true, webhook: info.url, pending: info.pending_update_count })
  } catch (error) {
    console.error("[v0] Webhook sozlash xatosi:", error)
    return NextResponse.json({ ok: false, error: "Webhook sozlanmadi" }, { status: 500 })
  }
}
