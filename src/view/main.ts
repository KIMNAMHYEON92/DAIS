import './styles.css';

const app = document.querySelector<HTMLElement>('#app');

if (app === null) {
  throw new Error('DAIS application root was not found.');
}

const webGPUSupported = 'gpu' in navigator;

app.innerHTML = `
  <section class="boot-panel" aria-labelledby="boot-title">
    <p class="eyebrow">BAD ANDROID INTERROGATION STATION</p>
    <h1 id="boot-title">DAIS // MILESTONE 0</h1>
    <p>격리형 개발 샌드박스가 준비되었습니다.</p>
    <dl>
      <div>
        <dt>WebGPU</dt>
        <dd data-status="${webGPUSupported ? 'ready' : 'fallback'}">
          ${webGPUSupported ? 'READY' : 'FALLBACK REQUIRED'}
        </dd>
      </div>
      <div>
        <dt>IndexedDB</dt>
        <dd data-status="ready">${'indexedDB' in globalThis ? 'READY' : 'UNAVAILABLE'}</dd>
      </div>
    </dl>
  </section>
`;
