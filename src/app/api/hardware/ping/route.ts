import { NextResponse } from 'next/server';
import net from 'net';

export async function POST(req: Request) {
  try {
    const { ip, port = 9100 } = await req.json();

    if (!ip || typeof ip !== 'string') {
      return NextResponse.json({ success: false, message: 'Invalid IP address' }, { status: 400 });
    }

    const cleanIp = ip.trim();
    const portNum = Number(port) || 9100;

    const reachable = await new Promise<boolean>((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(3000);

      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });

      socket.on('error', () => {
        socket.destroy();
        resolve(false);
      });

      socket.connect(portNum, cleanIp);
    });

    if (reachable) {
      return NextResponse.json({
        success: true,
        message: `Connected successfully to Kitchen KOT printer at ${cleanIp}:${portNum}`
      });
    } else {
      return NextResponse.json({
        success: false,
        message: `Kitchen printer unreachable at ${cleanIp}:${portNum}. Verify printer power, LAN cable, and IP.`
      });
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || 'Connection test failed' });
  }
}
