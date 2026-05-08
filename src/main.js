import {LeapfrogMachine, builtInPrograms} from './emulator.js';

const canvas = document.getElementById('screen');
const startButton = document.getElementById('start-button');
const playButton = document.getElementById('play-button');
const stopButton = document.getElementById('stop-button');
const resetButton = document.getElementById('reset-button');
const programSelect = document.getElementById('program-select');
const logOutput = document.getElementById('log-output');
const romFile = document.getElementById('rom-file');
const selectDidj = document.getElementById('select-didj');
const selectLeapster = document.getElementById('select-leapster');

const machine = new LeapfrogMachine(canvas, updateLog);
let selectedFile = null;

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

async function loadFromZip(file) {
  try {
    const zip = await JSZip.loadAsync(file);
    // Look for JSON files in the zip
    const jsonFiles = Object.keys(zip.files).filter(name => name.endsWith('.json') && !zip.files[name].dir);
    if (jsonFiles.length === 0) throw new Error('No JSON file found in ZIP.');
    // Load the first JSON file
    const jsonContent = await zip.files[jsonFiles[0]].async('text');
    return JSON.parse(jsonContent);
  } catch (error) {
    throw new Error(`Failed to load ZIP: ${error.message}`);
  }
}

async function loadFromBin(file) {
  try {
    // Try to parse as JSON first
    const text = await file.text();
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Failed to load BIN: ${error.message}`);
  }
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
playButton.addEventListener('click', async () => {
  if (!selectedFile) return;
  try {
    let payload;
    if (selectedFile.name.endsWith('.zip')) {
      payload = await loadFromZip(selectedFile);
    } else if (selectedFile.name.endsWith('.bin') || selectedFile.name.endsWith('.iso')) {
      payload = await loadFromBin(selectedFile);
    } else {
      throw new Error('Unsupported file format. Please use .bin, .zip, or .iso files.');
    }
    if (!payload.instructions) throw new Error('Invalid ROM format.');
    machine.setDevice(payload.device || 'didj');
    setActiveDevice(payload.device || 'didj');
    machine.loadProgram(payload);
    machine.start();
    updateLog(`Loaded and started ROM: ${selectedFile.name}`);
  } catch (error) {
    updateLog(`ROM error: ${error.message}`);
  }
});
stopButton.addEventListener('click', () => machine.stop());
resetButton.addEventListener('click', () => {
  machine.resetState();
  chooseProgram(programSelect.value);
});

programSelect.addEventListener('change', (event) => {
  chooseProgram(event.target.value);
});

romFile.addEventListener('change', (event) => {
  const file = event.target.files?.[0];
  if (!file) {
    selectedFile = null;
    playButton.disabled = true;
    return;
  }
  selectedFile = file;
  playButton.disabled = false;
  updateLog(`Selected ROM: ${file.name}`);
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
