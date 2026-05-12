let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

export function playClick() {
  try {
    initAudio();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
  } catch(e) {
    console.log("Audio play blocked");
  }
}

export function playSuccess() {
  try {
    initAudio();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    // Play a happy arpeggio chord for applause/success
    const playNote = (freq, time, duration) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, audioCtx.currentTime + time);
      gain.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + time + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + time + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(audioCtx.currentTime + time);
      osc.stop(audioCtx.currentTime + time + duration);
    };

    playNote(440, 0, 0.5);       // A4
    playNote(554.37, 0.1, 0.5);  // C#5
    playNote(659.25, 0.2, 0.5);  // E5
    playNote(880, 0.3, 1.0);     // A5
  } catch(e) {
    console.log("Audio play blocked");
  }
}
