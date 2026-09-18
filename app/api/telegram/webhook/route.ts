import { NextResponse } from "next/server"
import { getBot } from "../../../../bot"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const update = await request.json()
    const bot = getBot()
    await bot.handleUpdate(update)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[v0] Telegram webhook xatosi:", error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "Telegram webhook ishlayapti" })
}
