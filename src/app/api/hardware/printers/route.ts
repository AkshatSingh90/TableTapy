import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function GET() {
  try {
    if (process.platform === 'win32') {
      const { stdout } = await execAsync(
        'powershell -NoProfile -Command "Get-CimInstance Win32_Printer | Select-Object -ExpandProperty Name"'
      );
      const printers = stdout
        .split(/\r?\n/)
        .map(s => s.trim())
        .filter(Boolean);
      return NextResponse.json({ printers });
    } else {
      const { stdout } = await execAsync('lpstat -p -d 2>/dev/null || true');
      const printers = stdout
        .split('\n')
        .filter(l => l.startsWith('printer '))
        .map(l => l.split(' ')[1])
        .filter(Boolean);
      return NextResponse.json({ printers });
    }
  } catch (err: any) {
    console.error('Failed to query printers via local API:', err);
    return NextResponse.json({ printers: [], error: err.message }, { status: 500 });
  }
}
