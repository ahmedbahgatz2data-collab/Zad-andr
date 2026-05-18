// timerWorker.js
let timer = null;

self.onmessage = (e) => {
  if (e.data === 'start') {
    if (timer) clearInterval(timer);
    timer = setInterval(() => {
      self.postMessage('tick');
    }, 60000); // Check every minute
  } else if (e.data === 'stop') {
    if (timer) clearInterval(timer);
  }
};
