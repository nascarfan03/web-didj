import {LeapfrogMachine, builtInPrograms} from './emulator.js';

const canvas = document.getElementById('screen');
const startButton = document.getElementById('start-button');
const stopButton = document.getElementById('stop-button');
const resetButton = document.getElementById('reset-button');
const programSelect = document.getElementById('program-select');
const logOutput = document.getElementById('log-output');
const romFile = document.getElementById('rom-file');
const selectDidj = document.getElementById('select-didj');
const selectLeapster = document.getElementById('select-leapster');

const machine = new LeapfrogMachine(canvas, updateLog);

function updateLog(message) {
  logOutput.textContent = `${message}\n${logOutput.textContent}`;
}

function chooseProgram(key) {
  const program = builtInPrograms[key];
  if (!program) return;
  machine.setDevice(program.device);
  machine.loadProgram(program);
  programSelect.value = key;
}

function setActiveDevice(device) {
  selectDidj.classList.toggle('active', device === 'didj');
  selectLeapster.classList.toggle('active', device === 'leapster');
}

selectDidj.addEventListener('click', () => {
  setActiveDevice('didj');
  chooseProgram('didj-demo');
});

selectLeapster.addEventListener('click', () => {
  setActiveDevice('leapster');
  chooseProgram('leapster-demo');
});

startButton.addEventListener('click', () => machine.start());
stopButton.addEventListener('click', () => machine.stop());
resetButton.addEventListener('click', () => {
  machine.resetState();
  chooseProgram(programSelect.value);
});

programSelect.addEventListener('change', (event) => {
  chooseProgram(event.target.value);
});

romFile.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    if (!payload.instructions) throw new Error('Invalid ROM format.');
    machine.setDevice(payload.device || 'didj');
    setActiveDevice(payload.device || 'didj');
    machine.loadProgram(payload);
    updateLog(`Loaded ROM: ${file.name}`);
  } catch (error) {
    updateLog(`ROM error: ${error.message}`);
  }
});

const keyMap = {
  ArrowUp: 'ArrowUp',
  ArrowDown: 'ArrowDown',
  ArrowLeft: 'ArrowLeft',
  ArrowRight: 'ArrowRight',
  z: 'z',
  x: 'x',
  Z: 'z',
  X: 'x',
  ' ': 'Space',
};

window.addEventListener('keydown', (event) => {
  if (event.key === ' ' && !event.repeat) {
    machine.start();
  }
  const mapped = keyMap[event.key];
  if (mapped) {
    machine.updateInput(mapped, true);
    event.preventDefault();
  }
});

window.addEventListener('keyup', (event) => {
  const mapped = keyMap[event.key];
  if (mapped) {
    machine.updateInput(mapped, false);
    event.preventDefault();
  }
});

canvas.addEventListener('pointerdown', () => {
  machine.updateInput('z', true);
});
canvas.addEventListener('pointerup', () => {
  machine.updateInput('z', false);
});

chooseProgram('didj-demo');
setActiveDevice('didj');
