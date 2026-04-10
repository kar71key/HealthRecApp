const {spawnSync} = require('child_process');
const path = require('path');

const toWslPath = input => {
  const normalized = input.replace(/\\/g, '/');
  const result = spawnSync('wsl.exe', ['wslpath', '-a', normalized], {
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    process.stderr.write(result.stderr || `Failed to convert path: ${input}\n`);
    process.exit(result.status || 1);
  }

  return result.stdout.trim();
};

const hermesWin = path.resolve(__dirname, '..', 'node_modules', 'hermes-compiler', 'hermesc', 'linux64-bin', 'hermesc');
const hermesWsl = toWslPath(hermesWin);

const incomingArgs = process.argv.slice(2);
const convertedArgs = [];

for (let i = 0; i < incomingArgs.length; i += 1) {
  const arg = incomingArgs[i];

  if (arg === '-out') {
    convertedArgs.push(arg);
    i += 1;
    if (i < incomingArgs.length) {
      convertedArgs.push(toWslPath(incomingArgs[i]));
    }
    continue;
  }

  if (arg === '-max-diagnostic-width') {
    convertedArgs.push(arg);
    i += 1;
    if (i < incomingArgs.length) {
      convertedArgs.push(incomingArgs[i]);
    }
    continue;
  }

  if (arg.startsWith('-')) {
    convertedArgs.push(arg);
    continue;
  }

  convertedArgs.push(toWslPath(arg));
}

const result = spawnSync('wsl.exe', [hermesWsl, ...convertedArgs], {
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
