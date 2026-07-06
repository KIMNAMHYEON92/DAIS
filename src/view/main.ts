import './styles.css';
import './gameStyles.css';
import { GameApplication } from './gameApp';
import { QaApplication } from './qaApp';

const app = document.querySelector<HTMLElement>('#app');

if (app === null) {
  throw new Error('DAIS application root was not found.');
}

const mode = new URLSearchParams(window.location.search).get('mode');

if (mode === 'qa') {
  const qaApplication = new QaApplication(app);
  void qaApplication.start();
} else {
  const gameApplication = new GameApplication(app);
  void gameApplication.start();
}
