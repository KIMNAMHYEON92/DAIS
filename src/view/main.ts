import './styles.css';
import { QaApplication } from './qaApp';

const app = document.querySelector<HTMLElement>('#app');

if (app === null) {
  throw new Error('DAIS application root was not found.');
}

const qaApplication = new QaApplication(app);
void qaApplication.start();
