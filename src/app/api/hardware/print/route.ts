import { NextResponse } from 'next/server';
import { buildEscposBinaryBuffer } from '@/lib/escposBuilder';
import net from 'net';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(req: Request) {
  try {
    const { chit, printerName, network } = await req.json();

    if (!chit) {
      return NextResponse.json({ success: false, error: 'Chit payload missing' }, { status: 400 });
    }

    const binaryBuffer = buildEscposBinaryBuffer(chit);

    // 1. Network IP Printer (Kitchen KOT Ethernet / Wi-Fi)
    if (network && network.ip) {
      const ip = network.ip.trim();
      const port = Number(network.port) || 9100;

      const success = await new Promise<boolean>((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(4000);

        socket.connect(port, ip, () => {
          socket.write(binaryBuffer, () => {
            socket.end(() => resolve(true));
          });
        });

        socket.on('error', (err) => {
          console.error('[API Print] Network socket error:', err);
          socket.destroy();
          resolve(false);
        });

        socket.on('timeout', () => {
          console.error('[API Print] Network socket timed out');
          socket.destroy();
          resolve(false);
        });
      });

      if (success) {
        return NextResponse.json({ success: true, method: 'network_socket' });
      } else {
        return NextResponse.json({
          success: false,
          error: `Could not connect to kitchen printer at ${ip}:${port}`
        }, { status: 500 });
      }
    }

    // 2. Windows Spooler Thermal Printer
    if (process.platform === 'win32') {
      const tempPath = path.join(os.tmpdir(), `chit_escpos_${Date.now()}_${Math.random().toString(36).substring(7)}.bin`);
      fs.writeFileSync(tempPath, binaryBuffer);

      const scriptPath = path.resolve(process.cwd(), 'src', 'lib', 'raw_print_helper.ps1');
      const targetPrinter = printerName || '';

      try {
        const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}" -PrinterName "${targetPrinter.replace(/"/g, '`"')}" -FilePath "${tempPath.replace(/"/g, '`"')}"`;
        const { stdout, stderr } = await execAsync(cmd);

        try { fs.unlinkSync(tempPath); } catch {}

        if (stderr && !stdout.includes('SUCCESS')) {
          console.warn('[API Print] WinSpool script warning:', stderr);
        }

        return NextResponse.json({ success: true, method: 'winspool_helper' });
      } catch (err: any) {
        try { fs.unlinkSync(tempPath); } catch {}
        console.error('[API Print] WinSpool execution error:', err);
        return NextResponse.json({ success: false, error: err.message || 'Printing failed' }, { status: 500 });
      }
    }

    // Unix / Other
    return NextResponse.json({ success: true, method: 'unsupported_platform' });
  } catch (err: any) {
    console.error('[API Print] General error:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Print dispatch failed' }, { status: 500 });
  }
}
