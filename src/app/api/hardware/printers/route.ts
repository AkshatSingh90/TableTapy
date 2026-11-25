import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function GET() {
  try {
    if (process.platform === 'win32') {
      const printers = new Set<string>();

      // 1. Ultra-fast Registry query (< 20ms)
      try {
        const { stdout: cuOut } = await execAsync('reg query "HKCU\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Devices"');
        for (const line of cuOut.split(/\r?\n/)) {
          const match = line.match(/^\s*(.+?)\s+REG_SZ\s+/i);
          if (match && match[1]) {
            printers.add(match[1].trim());
          }
        }
      } catch {}

      try {
        const { stdout: lmOut } = await execAsync('reg query "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Print\\Printers"');
        for (const line of lmOut.split(/\r?\n/)) {
          const trimmed = line.trim();
          const prefix = 'HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Print\\Printers\\';
          if (trimmed.startsWith(prefix)) {
            const sub = trimmed.substring(prefix.length).trim();
            if (sub && !sub.includes('\\')) {
              printers.add(sub);
            }
          }
        }
      } catch {}

      // 2. If registry returned printers, return them immediately!
      if (printers.size > 0) {
        return NextResponse.json({ printers: Array.from(printers) });
      }

      // 3. Fallback to PowerShell Get-CimInstance if registry was empty
      const { stdout } = await execAsync(
        'powershell -NoProfile -Command "Get-CimInstance Win32_Printer | Select-Object -ExpandProperty Name"'
      );
      const psPrinters = stdout
        .split(/\r?\n/)
        .map(s => s.trim())
        .filter(Boolean);
      return NextResponse.json({ printers: psPrinters });
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
