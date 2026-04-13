const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = 8081;

function killProcessesOnPort(port) {
  try {
    console.log(`Checking for processes on port ${port}...`);
    let command = '';
    if (process.platform === 'win32') {
      command = `netstat -ano | findstr :${port}`;
    } else {
      command = `lsof -i :${port} -t`;
    }

    const output = execSync(command).toString();
    const lines = output.split('\n');
    const pids = new Set();

    lines.forEach(line => {
      const parts = line.trim().split(/\s+/);
      if (process.platform === 'win32') {
        const pid = parts[parts.length - 1];
        if (pid && !isNaN(pid) && pid !== '0') pids.add(pid);
      } else {
        const pid = parts[0];
        if (pid && !isNaN(pid)) pids.add(pid);
      }
    });

    pids.forEach(pid => {
      console.log(`Killing process ${pid}...`);
      try {
        if (process.platform === 'win32') {
          execSync(`taskkill /F /PID ${pid} /T`);
        } else {
          execSync(`kill -9 ${pid}`);
        }
      } catch (e) {
        console.log(`Could not kill process ${pid}: ${e.message}`);
      }
    });
  } catch (err) {
    console.log(`Port ${port} is already free.`);
  }
}

console.log('--- EXPO CLEAN START ---');

// 1. Kill stale processes
killProcessesOnPort(PORT);

// 2. Clear Expo cache
const expoDir = path.join(process.cwd(), '.expo');
if (fs.existsSync(expoDir)) {
  console.log('Clearing .expo cache...');
  fs.rmSync(expoDir, { recursive: true, force: true });
}

// 3. Start Expo with LAN
console.log('Starting Expo on LAN...');
try {
  execSync('npx expo start --lan --port 8081 -c', { stdio: 'inherit' });
} catch (e) {
  console.error('Expo failed to start:', e.message);
}
