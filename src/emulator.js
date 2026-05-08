const DEFAULT_WIDTH = 160;
const DEFAULT_HEIGHT = 120;

const toNumber = (value, state) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    if (value in state.registers) return state.registers[value];
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export class LeapfrogMachine {
  constructor(canvas, logCallback = () => {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.logCallback = logCallback;
    this.screenWidth = DEFAULT_WIDTH;
    this.screenHeight = DEFAULT_HEIGHT;
    this.inputs = {};
    this.resetState();
    this.updateScreen();
  }

  resetState() {
    this.registers = {
      A: 0,
      B: 0,
      C: 0,
      D: 0,
      E: 0,
      F: 0,
      PC: 0,
      Z: 0,
    };
    this.running = false;
    this.waitCycles = 0;
    this.labels = {};
    this.screenBuffer = new Uint32Array(this.screenWidth * this.screenHeight);
    this.program = null;
    this.clearScreen();
    this.log('Machine reset.');
  }

  clearScreen() {
    this.screenBuffer.fill(0xff071e2d);
    this.updateScreen();
  }

  setDevice(device) {
    this.device = device;
    this.log(`Device set to ${device}.`);
  }

  loadProgram(program) {
    this.program = program;
    this.registers.PC = 0;
    this.waitCycles = 0;
    this.labels = {};
    this.resolveLabels();
    this.clearScreen();
    this.log(`Loaded ${program.name}.`);
  }

  resolveLabels() {
    if (!this.program?.instructions) return;
    this.labels = {};
    this.program.instructions.forEach((instr, index) => {
      if (instr.op === 'LABEL' && instr.name) {
        this.labels[instr.name] = index;
      }
    });
  }

  start() {
    if (!this.program) {
      this.log('No program loaded.');
      return;
    }
    if (this.running) return;
    this.running = true;
    this.log('Emulator started.');
    this.stepLoop();
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    this.log('Emulator stopped.');
  }

  stepLoop() {
    if (!this.running) return;
    this.step();
    setTimeout(() => this.stepLoop(), 50);
  }

  step() {
    if (this.waitCycles > 0) {
      this.waitCycles -= 1;
      return;
    }
    const instructions = this.program?.instructions;
    if (!instructions || this.registers.PC >= instructions.length) {
      this.stop();
      return;
    }

    const instr = instructions[this.registers.PC];
    this.execute(instr);
  }

  execute(instr) {
    if (!instr || typeof instr !== 'object') {
      this.registers.PC += 1;
      return;
    }

    const {op} = instr;
    switch (op) {
      case 'NOP':
        break;
      case 'CLS':
        this.clearScreen();
        break;
      case 'PIX':
        this.drawPixel(instr.x, instr.y, instr.color || '#85ff9f');
        break;
      case 'RECT':
        this.drawRect(instr.x, instr.y, instr.w, instr.h, instr.color || '#6cd2ff');
        break;
      case 'TEXT':
        this.drawText(instr.x, instr.y, instr.text || '', instr.color || '#e5edf8');
        break;
      case 'MOV':
        if (instr.dst in this.registers) {
          this.registers[instr.dst] = toNumber(instr.src, this);
        }
        break;
      case 'ADD':
        if (instr.dst in this.registers) {
          this.registers[instr.dst] += toNumber(instr.src, this);
          this.registers[instr.dst] &= 0xff;
        }
        break;
      case 'SUB':
        if (instr.dst in this.registers) {
          this.registers[instr.dst] -= toNumber(instr.src, this);
          this.registers[instr.dst] &= 0xff;
        }
        break;
      case 'CMP':
        this.registers.Z = toNumber(instr.a, this) === toNumber(instr.b, this) ? 1 : 0;
        break;
      case 'JMP':
        this.jump(instr.label);
        return;
      case 'JEQ':
        if (this.registers.Z === 1) {
          this.jump(instr.label);
          return;
        }
        break;
      case 'JNE':
        if (this.registers.Z === 0) {
          this.jump(instr.label);
          return;
        }
        break;
      case 'IN':
        if (instr.dst in this.registers) {
          const key = instr.key || 'none';
          this.registers[instr.dst] = this.inputs[key] ? 1 : 0;
        }
        break;
      case 'WAIT':
        this.waitCycles = Math.max(0, instr.cycles || 1);
        break;
      case 'HALT':
        this.stop();
        return;
      case 'LABEL':
        break;
      default:
        this.log(`Unknown op ${op}`);
    }

    this.registers.PC += 1;
  }

  jump(label) {
    if (label && this.labels[label] !== undefined) {
      this.registers.PC = this.labels[label];
    } else {
      this.log(`Jump target not found: ${label}`);
      this.registers.PC += 1;
    }
  }

  drawPixel(x, y, color) {
    const ix = clamp(Math.floor(x), 0, this.screenWidth - 1);
    const iy = clamp(Math.floor(y), 0, this.screenHeight - 1);
    const index = iy * this.screenWidth + ix;
    this.screenBuffer[index] = this.parseColor(color);
    this.updateScreen();
  }

  drawRect(x, y, w, h, color) {
    const parsed = this.parseColor(color);
    const x0 = clamp(Math.floor(x), 0, this.screenWidth);
    const y0 = clamp(Math.floor(y), 0, this.screenHeight);
    const x1 = clamp(Math.floor(x + w), 0, this.screenWidth);
    const y1 = clamp(Math.floor(y + h), 0, this.screenHeight);
    for (let py = y0; py < y1; py += 1) {
      for (let px = x0; px < x1; px += 1) {
        this.screenBuffer[py * this.screenWidth + px] = parsed;
      }
    }
    this.updateScreen();
  }

  parseColor(color) {
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.fillStyle = color;
    return Number.parseInt(ctx.fillStyle.slice(1), 16) | 0xff000000;
  }

  drawText(x, y, text, color) {
    this.updateScreen();
    this.ctx.font = 'bold 12px Inter, sans-serif';
    this.ctx.fillStyle = color;
    this.ctx.fillText(text, x, y + 12);
  }

  updateScreen() {
    const imageData = this.ctx.createImageData(this.screenWidth, this.screenHeight);
    for (let i = 0; i < this.screenBuffer.length; i += 1) {
      const value = this.screenBuffer[i];
      const offset = i * 4;
      imageData.data[offset + 0] = (value >> 16) & 0xff;
      imageData.data[offset + 1] = (value >> 8) & 0xff;
      imageData.data[offset + 2] = value & 0xff;
      imageData.data[offset + 3] = 0xff;
    }
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.putImageData(imageData, 0, 0);
  }

  updateInput(key, active) {
    this.inputs[key] = active;
  }

  log(message) {
    this.logCallback(`[${new Date().toLocaleTimeString()}] ${message}`);
  }
}

export const builtInPrograms = {
  'didj-demo': {
    name: 'Didj Demo',
    device: 'didj',
    instructions: [
      {op: 'CLS'},
      {op: 'TEXT', x: 8, y: 8, text: 'LeapFrog Didj Demo', color: '#85ff9f'},
      {op: 'TEXT', x: 8, y: 26, text: 'Press Z / X or arrows', color: '#d6e0ff'},
      {op: 'LABEL', name: 'main'},
      {op: 'IN', dst: 'A', key: 'ArrowUp'},
      {op: 'CMP', a: 'A', b: 1},
      {op: 'JEQ', label: 'up'},
      {op: 'IN', dst: 'A', key: 'ArrowDown'},
      {op: 'CMP', a: 'A', b: 1},
      {op: 'JEQ', label: 'down'},
      {op: 'IN', dst: 'A', key: 'ArrowLeft'},
      {op: 'CMP', a: 'A', b: 1},
      {op: 'JEQ', label: 'left'},
      {op: 'IN', dst: 'A', key: 'ArrowRight'},
      {op: 'CMP', a: 'A', b: 1},
      {op: 'JEQ', label: 'right'},
      {op: 'IN', dst: 'A', key: 'z'},
      {op: 'CMP', a: 'A', b: 1},
      {op: 'JEQ', label: 'buttonA'},
      {op: 'IN', dst: 'A', key: 'x'},
      {op: 'CMP', a: 'A', b: 1},
      {op: 'JEQ', label: 'buttonB'},
      {op: 'TEXT', x: 8, y: 56, text: 'Waiting for input...', color: '#a3bff1'},
      {op: 'WAIT', cycles: 4},
      {op: 'JMP', label: 'main'},
      {op: 'LABEL', name: 'up'},
      {op: 'CLS'},
      {op: 'TEXT', x: 8, y: 8, text: 'Didj Demo', color: '#85ff9f'},
      {op: 'TEXT', x: 8, y: 36, text: 'Arrow Up pressed', color: '#d6e0ff'},
      {op: 'WAIT', cycles: 10},
      {op: 'JMP', label: 'main'},
      {op: 'LABEL', name: 'down'},
      {op: 'CLS'},
      {op: 'TEXT', x: 8, y: 8, text: 'Didj Demo', color: '#85ff9f'},
      {op: 'TEXT', x: 8, y: 36, text: 'Arrow Down pressed', color: '#d6e0ff'},
      {op: 'WAIT', cycles: 10},
      {op: 'JMP', label: 'main'},
      {op: 'LABEL', name: 'left'},
      {op: 'CLS'},
      {op: 'TEXT', x: 8, y: 8, text: 'Didj Demo', color: '#85ff9f'},
      {op: 'TEXT', x: 8, y: 36, text: 'Arrow Left pressed', color: '#d6e0ff'},
      {op: 'WAIT', cycles: 10},
      {op: 'JMP', label: 'main'},
      {op: 'LABEL', name: 'right'},
      {op: 'CLS'},
      {op: 'TEXT', x: 8, y: 8, text: 'Didj Demo', color: '#85ff9f'},
      {op: 'TEXT', x: 8, y: 36, text: 'Arrow Right pressed', color: '#d6e0ff'},
      {op: 'WAIT', cycles: 10},
      {op: 'JMP', label: 'main'},
      {op: 'LABEL', name: 'buttonA'},
      {op: 'CLS'},
      {op: 'TEXT', x: 8, y: 8, text: 'Didj Demo', color: '#85ff9f'},
      {op: 'TEXT', x: 8, y: 36, text: 'A button pressed', color: '#d6e0ff'},
      {op: 'WAIT', cycles: 10},
      {op: 'JMP', label: 'main'},
      {op: 'LABEL', name: 'buttonB'},
      {op: 'CLS'},
      {op: 'TEXT', x: 8, y: 8, text: 'Didj Demo', color: '#85ff9f'},
      {op: 'TEXT', x: 8, y: 36, text: 'B button pressed', color: '#d6e0ff'},
      {op: 'WAIT', cycles: 10},
      {op: 'JMP', label: 'main'},
    ],
  },
  'leapster-demo': {
    name: 'Leapster Demo',
    device: 'leapster',
    instructions: [
      {op: 'CLS'},
      {op: 'TEXT', x: 8, y: 8, text: 'Leapster Demo', color: '#6cd2ff'},
      {op: 'TEXT', x: 8, y: 28, text: 'Use arrows and Z/X', color: '#d6e0ff'},
      {op: 'RECT', x: 40, y: 48, w: 80, h: 48, color: '#0f3b3f'},
      {op: 'TEXT', x: 16, y: 60, text: 'Move the dot with arrow keys', color: '#c1f7ff'},
      {op: 'LABEL', name: 'pulse'},
      {op: 'IN', dst: 'A', key: 'ArrowLeft'},
      {op: 'JEQ', label: 'moveLeft'},
      {op: 'IN', dst: 'A', key: 'ArrowRight'},
      {op: 'JEQ', label: 'moveRight'},
      {op: 'IN', dst: 'A', key: 'ArrowUp'},
      {op: 'JEQ', label: 'moveUp'},
      {op: 'IN', dst: 'A', key: 'ArrowDown'},
      {op: 'JEQ', label: 'moveDown'},
      {op: 'IN', dst: 'B', key: 'z'},
      {op: 'CMP', a: 'B', b: 1},
      {op: 'JEQ', label: 'flashA'},
      {op: 'IN', dst: 'B', key: 'x'},
      {op: 'CMP', a: 'B', b: 1},
      {op: 'JEQ', label: 'flashB'},
      {op: 'RECT', x: 84, y: 80, w: 8, h: 8, color: '#d9f1ff'},
      {op: 'WAIT', cycles: 2},
      {op: 'JMP', label: 'pulse'},
      {op: 'LABEL', name: 'moveLeft'},
      {op: 'TEXT', x: 12, y: 100, text: 'Left', color: '#ffffff'},
      {op: 'WAIT', cycles: 6},
      {op: 'JMP', label: 'pulse'},
      {op: 'LABEL', name: 'moveRight'},
      {op: 'TEXT', x: 12, y: 100, text: 'Right', color: '#ffffff'},
      {op: 'WAIT', cycles: 6},
      {op: 'JMP', label: 'pulse'},
      {op: 'LABEL', name: 'moveUp'},
      {op: 'TEXT', x: 12, y: 100, text: 'Up', color: '#ffffff'},
      {op: 'WAIT', cycles: 6},
      {op: 'JMP', label: 'pulse'},
      {op: 'LABEL', name: 'moveDown'},
      {op: 'TEXT', x: 12, y: 100, text: 'Down', color: '#ffffff'},
      {op: 'WAIT', cycles: 6},
      {op: 'JMP', label: 'pulse'},
      {op: 'LABEL', name: 'flashA'},
      {op: 'TEXT', x: 104, y: 100, text: 'Z=A', color: '#99f7ff'},
      {op: 'WAIT', cycles: 6},
      {op: 'JMP', label: 'pulse'},
      {op: 'LABEL', name: 'flashB'},
      {op: 'TEXT', x: 104, y: 100, text: 'X=B', color: '#99f7ff'},
      {op: 'WAIT', cycles: 6},
      {op: 'JMP', label: 'pulse'},
    ],
  },
};
